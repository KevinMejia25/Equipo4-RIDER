import './pwa.js';

import { supabase } from './supabaseClient.js';
import { exigirRol, cerrarSesion } from './guardia.js';
import { cargarHoja } from './datos-tecnico.js';

// Solo permite entrar a técnicos.
const perfil = await exigirRol('tecnico');

const elCargando = document.getElementById('estado-cargando');
const elError = document.getElementById('estado-error');
const elVacio = document.getElementById('estado-vacio');
const elLista = document.getElementById('lista-piezas');
const elSubtitulo = document.getElementById('subtitulo');
const elAvisoDatos = document.getElementById('aviso-datos');
const elErrorTitulo = document.getElementById('error-titulo');
const elErrorTexto = document.getElementById('error-texto');

let eventoIdActual = null;
let origenActual = 'red';

const FORMATO_DIA = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short'
});

const FORMATO_HORA = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

const TEXTO_CONDICION = {
  buen_estado: 'Buen estado',
  dañado: 'Dañado',
  faltante: 'Faltante'
};

document.getElementById('btn-salir')?.addEventListener('click', (e) => {
  e.preventDefault();
  cerrarSesion();
});

function formatoFecha(iso) {
  if (!iso) return '';

  const fecha = new Date(iso);

  if (Number.isNaN(fecha.getTime())) return '';

  return `${FORMATO_DIA.format(fecha)} · ${FORMATO_HORA.format(fecha)}`;
}

function mostrarSoloEstado(nombre) {
  elCargando.classList.toggle('oculto', nombre !== 'cargando');
  elError.classList.toggle('oculto', nombre !== 'error');
  elVacio.classList.toggle('oculto', nombre !== 'vacio');
  elLista.classList.toggle('oculto', nombre !== 'con-datos');
}

function mostrarError(titulo, mensaje) {
  elErrorTitulo.textContent = titulo;
  elErrorTexto.textContent = mensaje;
  elSubtitulo.textContent = '';
  mostrarSoloEstado('error');
}

function crearTexto(etiqueta, contenido, clase = '', estilo = '') {
  const elemento = document.createElement(etiqueta);
  elemento.textContent = contenido ?? '';

  if (clase) elemento.className = clase;
  if (estilo) elemento.style.cssText = estilo;

  return elemento;
}

function crearBoton(texto, clase, accion) {
  const boton = document.createElement('button');

  boton.type = 'button';
  boton.className = clase;
  boton.textContent = texto;
  boton.addEventListener('click', accion);

  return boton;
}

function crearTarjeta(pieza) {
  const tarjeta = document.createElement('div');
  tarjeta.className = 'tarjeta';

  tarjeta.append(
    crearTexto(
      'p',
      pieza.clave || 'SIN CLAVE',
      'tenue mb-0',
      'font-size:var(--t-xs);font-weight:700;text-transform:uppercase'
    ),
    crearTexto(
      'p',
      pieza.nombre || 'Equipo',
      'mb-0',
      'font-weight:700;margin-top:var(--e-1);overflow-wrap:anywhere'
    )
  );

  if (pieza.categoria) {
    tarjeta.append(
      crearTexto(
        'p',
        pieza.categoria,
        'pequeno tenue mb-0',
        'margin-top:var(--e-1)'
      )
    );
  }

  const filaEstado = document.createElement('div');
  filaEstado.style.marginTop = 'var(--e-3)';

  if (pieza.retorno_registrado) {
    const condicion =
      TEXTO_CONDICION[pieza.condicion_retorno] || 'Sin condición';

    const etiqueta = crearTexto(
      'span',
      `Retorno registrado · ${condicion}`,
      'etiqueta etiqueta--completado'
    );

    filaEstado.append(etiqueta);

    tarjeta.append(filaEstado);

    tarjeta.append(
      crearTexto(
        'p',
        `Salida: ${formatoFecha(pieza.salida_registrada)}`,
        'pieza-fecha'
      ),
      crearTexto(
        'p',
        `Retorno: ${formatoFecha(pieza.retorno_registrado)}`,
        'pieza-fecha'
      )
    );

    if (pieza.nota) {
      tarjeta.append(
        crearTexto('p', `Nota: ${pieza.nota}`, 'pieza-fecha')
      );
    }

  } else if (pieza.salida_registrada) {
    filaEstado.append(
      crearTexto(
        'span',
        'Salida registrada',
        'etiqueta etiqueta--completado'
      )
    );

    tarjeta.append(filaEstado);

    tarjeta.append(
      crearTexto(
        'p',
        `Fecha y hora de salida: ${formatoFecha(pieza.salida_registrada)}`,
        'pieza-fecha'
      )
    );

    const botonRetorno = crearBoton(
      'Registrar retorno',
      'btn',
      () => mostrarFormularioRetorno(pieza, tarjeta)
    );

    const acciones = document.createElement('div');
    acciones.className = 'pieza-acciones';
    acciones.append(botonRetorno);
    tarjeta.append(acciones);

  } else {
    filaEstado.append(
      crearTexto('span', 'Salida pendiente', 'etiqueta etiqueta--pendiente')
    );

    tarjeta.append(filaEstado);

    const botonSalida = crearBoton(
      'Marcar salida',
      'btn',
      () => marcarSalida(pieza, tarjeta)
    );

    const acciones = document.createElement('div');
    acciones.className = 'pieza-acciones';
    acciones.append(botonSalida);
    tarjeta.append(acciones);
  }

  const item = document.createElement('li');
  item.append(tarjeta);

  return item;
}

async function marcarSalida(pieza, tarjeta) {
  if (!navigator.onLine || origenActual === 'local') {
    alert('Para registrar la salida necesitas conexión a internet.');
    return;
  }

  if (!confirm(`¿Confirmas la salida de ${pieza.nombre}?`)) {
    return;
  }

  const boton = tarjeta.querySelector('button');

  if (boton) {
    boton.disabled = true;
    boton.textContent = 'Guardando...';
  }

  const fechaSalida = new Date().toISOString();

  const { error } = await supabase
    .from('evento_equipo')
    .update({
      salida_registrada: fechaSalida,
      pendiente_envio: false
    })
    .eq('id', pieza.id)
    .is('salida_registrada', null);

  if (error) {
    console.error('Error registrando salida:', error);
    alert(`No se pudo registrar la salida: ${error.message}`);
    await cargar();
    return;
  }

  alert('Salida registrada correctamente.');
  await cargar();
}

function mostrarFormularioRetorno(pieza, tarjeta) {
  if (!navigator.onLine || origenActual === 'local') {
    alert('Para registrar el retorno necesitas conexión a internet.');
    return;
  }

  if (tarjeta.querySelector('.pieza-formulario')) return;

  const formulario = document.createElement('div');
  formulario.className = 'pieza-formulario';

  const etiquetaCondicion = crearTexto(
    'label',
    'Condición del equipo al regresar'
  );

  const select = document.createElement('select');
  select.required = true;

  select.innerHTML = `
    <option value="">Selecciona una condición</option>
    <option value="buen_estado">Buen estado</option>
    <option value="dañado">Dañado</option>
    <option value="faltante">Faltante</option>
  `;

  etiquetaCondicion.append(select);

  const etiquetaNota = crearTexto('label', 'Nota (opcional)');

  const nota = document.createElement('textarea');
  nota.maxLength = 500;
  nota.placeholder = 'Describe algún daño, faltante u observación...';

  etiquetaNota.append(nota);

  const mensaje = crearTexto('p', '', 'pieza-mensaje');

  const btnGuardar = crearBoton(
    'Guardar retorno',
    'btn',
    () => guardarRetorno(pieza, select, nota, btnGuardar, mensaje)
  );

  const btnCancelar = crearBoton(
    'Cancelar',
    'btn btn--secundario',
    () => formulario.remove()
  );

  const acciones = document.createElement('div');
  acciones.className = 'pieza-acciones';
  acciones.append(btnGuardar, btnCancelar);

  formulario.append(etiquetaCondicion, etiquetaNota, mensaje, acciones);
  tarjeta.append(formulario);
}

async function guardarRetorno(pieza, select, nota, boton, mensaje) {
  if (!select.value) {
    mensaje.textContent = 'Selecciona la condición del equipo.';
    return;
  }

  if (!navigator.onLine || origenActual === 'local') {
    mensaje.textContent = 'Necesitas conexión a internet para guardar.';
    return;
  }

  boton.disabled = true;
  boton.textContent = 'Guardando...';

  const fechaRetorno = new Date().toISOString();

  const { error } = await supabase
    .from('evento_equipo')
    .update({
      retorno_registrado: fechaRetorno,
      condicion_retorno: select.value,
      nota: nota.value.trim() || null,
      pendiente_envio: false
    })
    .eq('id', pieza.id)
    .not('salida_registrada', 'is', null)
    .is('retorno_registrado', null);

  if (error) {
    console.error('Error registrando retorno:', error);
    mensaje.textContent = `No se pudo guardar: ${error.message}`;
    boton.disabled = false;
    boton.textContent = 'Intentar de nuevo';
    return;
  }

  alert('Retorno registrado correctamente.');
  await cargar();
}

async function cargar() {
  const parametros = new URLSearchParams(window.location.search);

  eventoIdActual =
    parametros.get('evento_id') || parametros.get('id');

  if (!eventoIdActual) {
    mostrarError(
      'Falta el evento',
      'Abre la hoja de carga desde la lista de Mis eventos.'
    );
    return;
  }

  mostrarSoloEstado('cargando');

  let resultado;

  try {
    resultado = await cargarHoja(eventoIdActual, perfil);
  } catch (error) {
    console.error('Error al cargar hoja:', error);

    mostrarError(
      'No pudimos cargar la hoja de carga',
      'Revisa tu conexión e inténtalo de nuevo.'
    );

    return;
  }

  if (resultado.noExiste) {
    mostrarError(
      'No encontramos este evento',
      resultado.origen === 'local'
        ? 'Esta hoja no está guardada en este dispositivo.'
        : 'Puede que el evento ya no esté asignado a ti.'
    );
    return;
  }

  origenActual = resultado.origen;

  elSubtitulo.textContent =
    `${resultado.evento.nombre} · ${formatoFecha(resultado.evento.fecha_montaje)}`;

  if (origenActual === 'local') {
    elAvisoDatos.textContent =
      'Mostrando la hoja guardada en este dispositivo. Conéctate para registrar salidas y retornos.';
    elAvisoDatos.classList.remove('oculto');
  } else {
    elAvisoDatos.classList.add('oculto');
  }

  if (!resultado.piezas || resultado.piezas.length === 0) {
    mostrarSoloEstado('vacio');
    return;
  }

  elLista.replaceChildren(
    ...resultado.piezas.map(crearTarjeta)
  );

  mostrarSoloEstado('con-datos');
}

window.addEventListener('online', () => {
  cargar();
});

cargar();