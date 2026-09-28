import { supabase } from './supabaseClient.js';

const form = document.getElementById('form-nuevo-equipo');
const selectCategoria = document.getElementById('categoria_id');
const btnGuardar = document.getElementById('btn-guardar');
const avisoError = document.getElementById('aviso-error');
const avisoErrorTexto = document.getElementById('aviso-error-texto');


// ================================================================
// CERRAR SESIÓN
// ================================================================

document.getElementById('btn-salir')?.addEventListener('click', async (evento) => {

  evento.preventDefault();

  await supabase.auth.signOut();

  window.location.href = '/login.html';

});


// ================================================================
// ERRORES
// ================================================================

function limpiarErrores() {

  form.querySelectorAll('.campo').forEach((campo) => {

    campo.classList.remove('campo--error');

  });

  form.querySelectorAll('.campo__error').forEach((span) => {

    span.classList.add('oculto');

  });

}


function marcarError(inputId, mensaje = 'Este campo es obligatorio.') {

  const input = document.getElementById(inputId);

  if (!input) return;

  const campo = input.closest('.campo');

  if (!campo) return;

  campo.classList.add('campo--error');

  const span = campo.querySelector('.campo__error');

  if (span) {

    span.textContent = mensaje;

    span.classList.remove('oculto');

  }

}


function mostrarAvisoError(mensaje) {

  avisoErrorTexto.textContent = mensaje;

  avisoError.classList.remove('oculto');

}


function ocultarAvisoError() {

  avisoError.classList.add('oculto');

}


// ================================================================
// CARGAR CATEGORÍAS
// ================================================================

async function cargarCategorias() {

  selectCategoria.innerHTML = '';

  const opcionInicial = document.createElement('option');

  opcionInicial.value = '';
  opcionInicial.textContent = 'Cargando categorías...';

  selectCategoria.appendChild(opcionInicial);


  const { data, error } = await supabase

    .from('categorias')

    .select('id, nombre')

    .order('nombre', {
      ascending: true
    });


  if (error) {

    console.error(
      'Error al cargar categorías:',
      error
    );

    selectCategoria.innerHTML = '';

    const opcionError = document.createElement('option');

    opcionError.value = '';
    opcionError.textContent = 'No se pudieron cargar las categorías';

    selectCategoria.appendChild(opcionError);

    mostrarAvisoError(
      'No se pudo cargar la lista de categorías. Verifica que la tabla "categorias" exista en Supabase y que tenga registros.'
    );

    return;

  }


  if (!data || data.length === 0) {

    selectCategoria.innerHTML = '';

    const opcionVacia = document.createElement('option');

    opcionVacia.value = '';
    opcionVacia.textContent = 'No hay categorías disponibles';

    selectCategoria.appendChild(opcionVacia);

    mostrarAvisoError(
      'No existen categorías registradas. Primero debes crear categorías en Supabase.'
    );

    return;

  }


  selectCategoria.innerHTML = '';

  const opcionSeleccion = document.createElement('option');

  opcionSeleccion.value = '';
  opcionSeleccion.textContent = 'Selecciona una categoría';

  selectCategoria.appendChild(opcionSeleccion);


  data.forEach((categoria) => {

    const option = document.createElement('option');

    option.value = categoria.id;

    option.textContent = categoria.nombre;

    selectCategoria.appendChild(option);

  });


  console.log(
    `Se cargaron ${data.length} categorías.`
  );

}


// ================================================================
// VALIDAR FORMULARIO
// ================================================================

function validarFormulario(datos) {

  limpiarErrores();

  let esValido = true;


  if (!datos.clave) {

    marcarError(
      'clave',
      'La clave es obligatoria.'
    );

    esValido = false;

  }


  if (!datos.nombre) {

    marcarError(
      'nombre',
      'El nombre del equipo es obligatorio.'
    );

    esValido = false;

  }


  if (!datos.categoria_id) {

    marcarError(
      'categoria_id',
      'Selecciona una categoría.'
    );

    esValido = false;

  }


  return esValido;

}


// ================================================================
// GUARDAR EQUIPO
// ================================================================

form.addEventListener('submit', async (evento) => {

  evento.preventDefault();

  ocultarAvisoError();


  const datos = Object.fromEntries(
    new FormData(form).entries()
  );


  datos.clave = (datos.clave || '')
    .trim()
    .toUpperCase();


  datos.nombre = (datos.nombre || '')
    .trim();


  if (!validarFormulario(datos)) {

    return;

  }


  btnGuardar.disabled = true;

  btnGuardar.textContent = 'Guardando…';


  try {

    const { error } = await supabase

      .from('equipos')

      .insert({

        clave: datos.clave,

        nombre: datos.nombre,

        categoria_id: datos.categoria_id,

        marca: datos.marca?.trim() || null,

        modelo: datos.modelo?.trim() || null,

        numero_serie: datos.numero_serie?.trim() || null,

        condicion: datos.condicion,

        activo: datos.activo === 'true'

      });


    if (error) {

      throw error;

    }


    window.location.href = '/inventario.html';


  } catch (error) {

    console.error(
      'Error al guardar equipo:',
      error
    );


    // CLAVE DUPLICADA

    if (error.code === '23505') {

      marcarError(
        'clave',
        `Ya existe un equipo con la clave ${datos.clave}.`
      );

      document.getElementById('clave')?.focus();

    }


    // PROBLEMA DE RELACIÓN CON CATEGORÍA

    else if (error.code === '23503') {

      mostrarAvisoError(
        'La categoría seleccionada no existe. Actualiza las categorías e inténtalo nuevamente.'
      );

    }


    // PROBLEMA DE PERMISOS

    else if (error.code === '42501') {

      mostrarAvisoError(
        'No tienes permiso para dar de alta equipo. Inicia sesión como coordinador.'
      );

    }


    // PROBLEMA DE CONEXIÓN

    else if (
      error.message?.toLowerCase().includes('fetch')
    ) {

      mostrarAvisoError(
        'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo nuevamente.'
      );

    }


    // OTRO ERROR

    else {

      mostrarAvisoError(
        'No se pudo guardar el equipo. Inténtalo nuevamente.'
      );

    }


    btnGuardar.disabled = false;

    btnGuardar.textContent = 'Guardar equipo';

  }

});

/* =========================================================
   INDICADOR DE ESTADO DEL REGISTRO
========================================================= */

const estadoRegistro =
  document.getElementById('estado_registro');

const contenedorIndicador =
  estadoRegistro?.closest(
    '.alta-select-con-indicador'
  );


function actualizarIndicadorEstado() {

  if (
    !estadoRegistro ||
    !contenedorIndicador
  ) {
    return;
  }

  contenedorIndicador.classList.remove(
    'activo',
    'inactivo'
  );

  contenedorIndicador.classList.add(
    estadoRegistro.value
  );
}


estadoRegistro?.addEventListener(
  'change',
  actualizarIndicadorEstado
);


actualizarIndicadorEstado();


// ================================================================
// INICIAR
// ================================================================

limpiarErrores();

cargarCategorias();