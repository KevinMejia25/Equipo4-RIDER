import { supabase } from './supabaseClient.js';

const form          = document.getElementById('form-nuevo-evento');
const selectCliente  = document.getElementById('cliente_id');
const btnGuardar     = document.getElementById('btn-guardar');
const btnCancelar    = document.getElementById('btn-cancelar');
const avisoError     = document.getElementById('aviso-error');
const avisoErrorTexto = document.getElementById('aviso-error-texto');

// ── 1 · Llenar el <select> de clientes desde Supabase ──
async function cargarClientes() {
  const { data, error } = await supabase
    .from('clientes')
    .select('id, nombre')
    .order('nombre', { ascending: true });

  if (error) {
    console.error('Error al cargar clientes:', error);
    mostrarAvisoError('No se pudo cargar la lista de clientes. Recarga la página.');
    return;
  }

  data.forEach((cliente) => {
    const option = document.createElement('option');
    option.value = cliente.id;
    option.textContent = cliente.nombre;
    selectCliente.appendChild(option);
  });
}

// ── 2 · Validación antes de enviar (RNF-03: validar antes de enviar) ──
// Nota: .campo__error y .aviso en ui.css traen "display" fijo, lo que
// anula el atributo `hidden` de HTML. Por eso usamos la clase utilitaria
// .oculto (display:none !important) que la propia hoja de estilos ya
// trae para estos casos, en vez de `hidden`.
function limpiarErrores() {
  form.querySelectorAll('.campo').forEach((campo) => {
    campo.classList.remove('campo--error');
  });
  form.querySelectorAll('.campo__error').forEach((span) => {
    span.classList.add('oculto');
  });
}

function marcarError(inputId) {
  const input = document.getElementById(inputId);
  const campo = input.closest('.campo');
  campo.classList.add('campo--error');
  campo.querySelector('.campo__error').classList.remove('oculto');
}

function validarFormulario(datos) {
  limpiarErrores();
  let esValido = true;

  const camposObligatorios = ['nombre', 'cliente_id', 'sede', 'fecha_montaje', 'fecha_inicio', 'fecha_fin'];
  for (const campo of camposObligatorios) {
    if (!datos[campo]) {
      marcarError(campo);
      esValido = false;
    }
  }

  // Regla de la sección 10: montaje ≤ inicio ≤ fin, sin margen
  if (datos.fecha_montaje && datos.fecha_inicio && datos.fecha_fin) {
    const montaje = new Date(datos.fecha_montaje);
    const inicio  = new Date(datos.fecha_inicio);
    const fin     = new Date(datos.fecha_fin);

    if (!(montaje <= inicio && inicio <= fin)) {
      marcarError('fecha_fin');
      esValido = false;
    }
  }

  return esValido;
}

// ── 3 · Manejo de errores generales (red, servidor) ──
function mostrarAvisoError(mensaje) {
  avisoErrorTexto.textContent = mensaje;
  avisoError.classList.remove('oculto');
}
function ocultarAvisoError() {
  avisoError.classList.add('oculto');
}

// ── 4 · Envío del formulario ──
form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  ocultarAvisoError();

  const formData = new FormData(form);
  const datos = Object.fromEntries(formData.entries());

  if (!validarFormulario(datos)) {
    return; // Nada se envía si la validación del cliente falla
  }

  btnGuardar.disabled = true;
  btnGuardar.textContent = 'Guardando…';

  try {
    const { error } = await supabase.from('eventos').insert({
      nombre: datos.nombre,
      cliente_id: datos.cliente_id,
      sede: datos.sede,
      direccion: datos.direccion || null,
      fecha_montaje: datos.fecha_montaje,
      fecha_inicio: datos.fecha_inicio,
      fecha_fin: datos.fecha_fin,
      notas: datos.notas || null,
      // estado no se manda: la tabla ya lo pone en 'cotizado' por default
    });

    if (error) {
      // Puede ser una violación de restricción del servidor (ej. la
      // regla fechas_en_orden) o un problema de red — cualquiera de
      // los dos cae aquí, nunca se pierde en silencio.
      throw error;
    }

    // Éxito: regresamos al listado
    window.location.href = '/eventos.html';

  } catch (error) {
    console.error('Error al guardar el evento:', error);
    mostrarAvisoError(
      error?.message?.includes('fetch')
        ? 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.'
        : 'No se pudo guardar el evento. Inténtalo de nuevo.'
    );
    btnGuardar.disabled = false;
    btnGuardar.textContent = 'Guardar evento';
  }
});

btnCancelar.addEventListener('click', () => {
  window.location.href = '/eventos.html';
});

// El HTML trae estos spans con `hidden`, pero esa clase de ui.css
// anula el atributo — los ocultamos también por JS al cargar.
limpiarErrores();

cargarClientes();