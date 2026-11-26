import { supabase } from './supabaseClient.js';

// =====================================================
// REFERENCIAS
// =====================================================

const formulario = document.getElementById('formulario-cliente');

const mensajeExito = document.getElementById('mensaje-exito');

const mensajeError = document.getElementById('mensaje-error');

const btnGuardar = document.getElementById('btn-guardar');

const inputNombre = document.getElementById('nombre');

const inputContacto = document.getElementById('contacto');

const inputTelefono = document.getElementById('telefono');

const inputCorreo = document.getElementById('correo');

const inputNotas = document.getElementById('notas');

// =====================================================
// MOSTRAR / OCULTAR MENSAJES
// =====================================================

function mostrarExito() {

    mensajeExito.classList.remove('oculto');

    mensajeError.classList.add('oculto');

}

function mostrarError(texto) {

    mensajeError.textContent = texto;

    mensajeError.classList.remove('oculto');

    mensajeExito.classList.add('oculto');

}

// =====================================================
// FORMATEAR TELÉFONO
// =====================================================

function formatearTelefono(valor) {

    const numeros = valor
        .replace(/\D/g, '')
        .slice(0, 10);

    if (numeros.length <= 3) {

        return numeros;

    }

    if (numeros.length <= 6) {

        return numeros.slice(0, 3) +
            '-' +
            numeros.slice(3);

    }

    return numeros.slice(0, 3) +
        '-' +
        numeros.slice(3, 6) +
        '-' +
        numeros.slice(6);

}

// =====================================================
// SOLO NÚMEROS EN TELÉFONO
// =====================================================

inputTelefono.addEventListener('input', () => {

    inputTelefono.value = formatearTelefono(
        inputTelefono.value
    );

});

// Evitar letras y caracteres especiales

inputTelefono.addEventListener('beforeinput', (evento) => {

    if (
        evento.inputType === 'insertText' &&
        evento.data &&
        /\D/.test(evento.data)
    ) {

        evento.preventDefault();

    }

});

// Formatear números pegados

inputTelefono.addEventListener('paste', (evento) => {

    evento.preventDefault();

    const texto = evento.clipboardData.getData('text');

    const inicio = inputTelefono.selectionStart;

    const fin = inputTelefono.selectionEnd;

    const valor =
        inputTelefono.value.slice(0, inicio) +
        texto +
        inputTelefono.value.slice(fin);

    inputTelefono.value = formatearTelefono(valor);

});

// =====================================================
// VALIDAR CORREO
// =====================================================

function validarCorreo(correo) {

    const expresion = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return expresion.test(correo);

}

// Evitar espacios en el correo

inputCorreo.addEventListener('input', () => {

    inputCorreo.value = inputCorreo.value.replace(/\s/g, '');

});

// =====================================================
// ENVIAR FORMULARIO
// =====================================================

formulario.addEventListener('submit', async (evento) => {

    evento.preventDefault();

    if (btnGuardar.disabled) return;

    mensajeExito.classList.add('oculto');

    mensajeError.classList.add('oculto');

    // =================================================
    // OBTENER DATOS
    // =================================================

    const nombre = inputNombre.value.trim();

    const contacto = inputContacto.value.trim();

    const telefono = inputTelefono.value.trim();

    const correo = inputCorreo.value.trim();

    const notas = inputNotas.value.trim();

    // =================================================
    // VALIDAR NOMBRE
    // =================================================

    if (!nombre) {

        mostrarError(
            'El nombre del cliente es obligatorio.'
        );

        inputNombre.focus();

        return;

    }

    // =================================================
    // VALIDAR CONTACTO
    // =================================================

    if (!contacto) {

        mostrarError(
            'El contacto del cliente es obligatorio.'
        );

        inputContacto.focus();

        return;

    }

    // =================================================
    // VALIDAR TELÉFONO
    // =================================================

    if (!telefono) {

        mostrarError(
            'El teléfono del cliente es obligatorio.'
        );

        inputTelefono.focus();

        return;

    }

    const numerosTelefono = telefono.replace(/\D/g, '');

    if (numerosTelefono.length !== 10) {

        mostrarError(
            'El teléfono debe contener exactamente 10 números.'
        );

        inputTelefono.focus();

        return;

    }

    // =================================================
    // VALIDAR CORREO
    // =================================================

    if (!correo) {

        mostrarError(
            'El correo electrónico es obligatorio.'
        );

        inputCorreo.focus();

        return;

    }

    if (!correo.includes('@')) {

        mostrarError(
            'El correo electrónico debe incluir el símbolo @.'
        );

        inputCorreo.focus();

        return;

    }

    if (!validarCorreo(correo)) {

        mostrarError(
            'Ingresa un correo válido. Ejemplo: usuario@gmail.com'
        );

        inputCorreo.focus();

        return;

    }

    // =================================================
    // DESACTIVAR BOTÓN
    // =================================================

    btnGuardar.disabled = true;

    btnGuardar.textContent = 'Guardando...';

    // =================================================
    // INSERTAR EN SUPABASE
    // =================================================

    try {

        const { error } = await supabase

            .from('clientes')

            .insert([

                {

                    nombre: nombre,

                    contacto: contacto,

                    telefono: formatearTelefono(telefono),

                    correo: correo,

                    notas: notas || null

                }

            ]);

        // =============================================
        // ERROR
        // =============================================

        if (error) {

            console.error(
                'Error al registrar cliente:',
                error
            );

            mostrarError(
                `No se pudo registrar el cliente: ${error.message}`
            );

            btnGuardar.disabled = false;

            btnGuardar.textContent = 'Guardar cliente';

            return;

        }

        // =============================================
        // ÉXITO
        // =============================================

        mostrarExito();

        formulario.reset();

        btnGuardar.textContent = 'Cliente guardado';

        // Regresar al listado después de guardar

        setTimeout(() => {

            window.location.href = '/clientes.html';

        }, 1000);

    } catch (error) {

        console.error(
            'Error inesperado:',
            error
        );

        mostrarError(
            `Error inesperado: ${error.message}`
        );

        btnGuardar.disabled = false;

        btnGuardar.textContent = 'Guardar cliente';

    }

});