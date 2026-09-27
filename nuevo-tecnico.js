import { supabase } from './supabaseClient.js';

const formulario = document.getElementById('formulario-tecnico');
const mensajeExito = document.getElementById('mensaje-exito');
const mensajeError = document.getElementById('mensaje-error');
const btnGuardar = document.getElementById('btn-guardar');

function mostrarExito() {
    mensajeExito.classList.remove('oculto');
    mensajeError.classList.add('oculto');
}

function mostrarError(texto) {
    mensajeError.textContent = texto;
    mensajeError.classList.remove('oculto');
    mensajeExito.classList.add('oculto');
}

formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    mensajeExito.classList.add('oculto');
    mensajeError.classList.add('oculto');

    const nombre = document.getElementById('nombre').value.trim();
    const correo = document.getElementById('correo').value.trim();
    const rol = document.getElementById('rol').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const activo = document.getElementById('activo').checked;

    if (!nombre) {
        mostrarError('El nombre del técnico es obligatorio.');
        document.getElementById('nombre').focus();
        return;
    }

    btnGuardar.disabled = true;
    btnGuardar.textContent = 'Guardando técnico...';

    console.log('Intentando registrar técnico:', {
        nombre,
        correo,
        rol,
        telefono,
        activo
    });

    try {

        const { data, error } = await supabase
            .from('usuarios')
            .insert([
                {
                    nombre: nombre,
                    correo: correo || null,
                    rol: rol || null,
                    telefono: telefono || null,
                    activo: activo
                }
            ])
            .select();

        console.log('Respuesta de Supabase:', {
            data,
            error
        });

        if (error) {
            console.error('Error de Supabase:', error);

            mostrarError(
                `Error: ${error.message}`
            );

            btnGuardar.disabled = false;
            btnGuardar.textContent = 'Guardar técnico';

            return;
        }

        mostrarExito();

        formulario.reset();

        document.getElementById('activo').checked = true;

        btnGuardar.disabled = false;
        btnGuardar.textContent = 'Guardar técnico';

        setTimeout(() => {
            window.location.href = '/cuadrilla.html';
        }, 1000);

    } catch (error) {

        console.error('Error inesperado:', error);

        mostrarError(
            `Error inesperado: ${error.message}`
        );

        btnGuardar.disabled = false;
        btnGuardar.textContent = 'Guardar técnico';
    }
});