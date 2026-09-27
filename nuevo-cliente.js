
import { supabase } from './supabaseClient.js';


// ─────────────────────────────────────────────
// REFERENCIAS
// ─────────────────────────────────────────────

const formulario =
  document.getElementById('formulario-cliente');

const mensajeExito =
  document.getElementById('mensaje-exito');

const mensajeError =
  document.getElementById('mensaje-error');

const btnGuardar =
  document.getElementById('btn-guardar');


// ─────────────────────────────────────────────
// MOSTRAR / OCULTAR MENSAJES
// ─────────────────────────────────────────────

function mostrarExito() {

  mensajeExito.classList.remove('oculto');

  mensajeError.classList.add('oculto');

}


function mostrarError(texto) {

  mensajeError.textContent = texto;

  mensajeError.classList.remove('oculto');

  mensajeExito.classList.add('oculto');

}


// ─────────────────────────────────────────────
// ENVIAR FORMULARIO
// ─────────────────────────────────────────────

formulario.addEventListener(
  'submit',
  async (evento) => {

    evento.preventDefault();


    mensajeExito.classList.add('oculto');

    mensajeError.classList.add('oculto');


    // ─────────────────────────────────────────
    // OBTENER DATOS
    // ─────────────────────────────────────────

    const nombre =
      document
        .getElementById('nombre')
        .value
        .trim();

    const contacto =
      document
        .getElementById('contacto')
        .value
        .trim();

    const telefono =
      document
        .getElementById('telefono')
        .value
        .trim();

    const correo =
      document
        .getElementById('correo')
        .value
        .trim();

    const notas =
      document
        .getElementById('notas')
        .value
        .trim();


    // ─────────────────────────────────────────
    // VALIDACIÓN
    // ─────────────────────────────────────────

    if (!nombre) {

      mostrarError(
        'El nombre del cliente es obligatorio.'
      );

      document
        .getElementById('nombre')
        .focus();

      return;

    }


    // ─────────────────────────────────────────
    // DESACTIVAR BOTÓN
    // ─────────────────────────────────────────

    btnGuardar.disabled = true;

    btnGuardar.textContent =
      'Guardando...';


    // ─────────────────────────────────────────
    // INSERTAR EN SUPABASE
    // ─────────────────────────────────────────

    const {
      error
    } = await supabase
      .from('clientes')
      .insert([
        {
          nombre: nombre,
          contacto: contacto || null,
          telefono: telefono || null,
          correo: correo || null,
          notas: notas || null
        }
      ]);


    // ─────────────────────────────────────────
    // ERROR
    // ─────────────────────────────────────────

    if (error) {

      console.error(
        'Error al registrar cliente:',
        error
      );

      mostrarError(
        'No se pudo registrar el cliente. Revisa la consola para más información.'
      );

      btnGuardar.disabled = false;

      btnGuardar.textContent =
        'Guardar cliente';

      return;

    }


    // ─────────────────────────────────────────
    // ÉXITO
    // ─────────────────────────────────────────

    mostrarExito();


    formulario.reset();


    btnGuardar.disabled = false;

    btnGuardar.textContent =
      'Guardar cliente';


    // Después de guardar, esperamos un momento
    // y regresamos al listado.

    setTimeout(() => {

      window.location.href =
        '/clientes.html';

    }, 1000);

  }
);
