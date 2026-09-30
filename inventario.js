import { supabase } from './supabaseClient.js';


/* =========================================================
   ELEMENTOS DEL DOM
========================================================= */

const elCargando = document.getElementById('estado-cargando');
const elVacio = document.getElementById('estado-vacio');
const elError = document.getElementById('estado-error');
const elConDatos = document.getElementById('estado-con-datos');
const elSinResultados = document.getElementById('sin-resultados');

const tbody = document.getElementById('tabla-equipos-body');

const inputBuscar = document.getElementById('buscar-equipo');
const selectCategoria = document.getElementById('filtro-categoria');
const selectDisponibilidad =
  document.getElementById('filtro-disponibilidad');

const contador = document.getElementById('contador-resultados');
const contadorFinal = document.getElementById('contador-final');

const btnReintentar =
  document.getElementById('btn-reintentar');


/* =========================================================
   CERRAR SESIÓN
========================================================= */

document.getElementById('btn-salir')?.addEventListener(
  'click',
  async (evento) => {

    evento.preventDefault();

    await supabase.auth.signOut();

    window.location.href = '/login.html';

  }
);


/* =========================================================
   CACHE
========================================================= */

let equiposCache = [];


/* =========================================================
   CONDICIONES
========================================================= */

const TEXTO_CONDICION = {
  buen_estado: 'Buen estado',
  'dañado': 'Dañado',
  faltante: 'Faltante'
};


/* =========================================================
   MOSTRAR ESTADO DE LA PÁGINA
========================================================= */

function mostrarSoloEstado(nombre) {

  const alternar = (elemento, mostrar) => {

    if (!elemento) return;

    elemento.classList.toggle(
      'oculto',
      !mostrar
    );

  };

  alternar(
    elCargando,
    nombre === 'cargando'
  );

  alternar(
    elVacio,
    nombre === 'vacio'
  );

  alternar(
    elError,
    nombre === 'error'
  );

  alternar(
    elConDatos,
    nombre === 'con-datos'
  );

}


/* =========================================================
   CREAR CELDA
========================================================= */

function celda(texto, clase = '') {

  const td = document.createElement('td');

  td.textContent = texto ?? '—';

  if (clase) {
    td.className = clase;
  }

  return td;

}


/* =========================================================
   OBTENER CONDICIÓN
========================================================= */

function obtenerCondicion(condicion) {

  return (
    TEXTO_CONDICION[condicion] ||
    condicion ||
    '—'
  );

}


/* =========================================================
   OBTENER ESTADO
========================================================= */

function obtenerEstado(equipo) {

  /*
   * Si posteriormente tu tabla equipos tiene
   * una columna "estado", se utilizará.
   */

  if (equipo.estado) {

    const estado =
      String(equipo.estado)
        .toLowerCase()
        .trim();

    if (
      estado === 'disponible' ||
      estado === 'en uso' ||
      estado === 'en_uso' ||
      estado === 'mantenimiento'
    ) {

      return estado;

    }

  }


  /* Dañado = mantenimiento */

  if (
    equipo.condicion === 'dañado'
  ) {

    return 'mantenimiento';

  }


  /* Activo = disponible */

  if (
    equipo.activo === true
  ) {

    return 'disponible';

  }


  return 'no-disponible';

}


/* =========================================================
   TEXTO DEL ESTADO
========================================================= */

function textoEstado(equipo) {

  const estado =
    obtenerEstado(equipo);

  if (estado === 'disponible') {
    return 'Disponible';
  }

  if (
    estado === 'en uso' ||
    estado === 'en_uso'
  ) {
    return 'En uso';
  }

  if (estado === 'mantenimiento') {
    return 'Mantenimiento';
  }

  return 'No disponible';

}


/* =========================================================
   CREAR PASTILLA DE ESTADO
========================================================= */

function crearEstado(equipo) {

  const estado =
    obtenerEstado(equipo);

  const span =
    document.createElement('span');

  span.classList.add(
    'inventario-estado'
  );


  if (
    estado === 'disponible'
  ) {

    span.classList.add(
      'inventario-estado--disponible'
    );

    span.textContent =
      'Disponible';

  }

  else if (
    estado === 'en uso' ||
    estado === 'en_uso'
  ) {

    span.classList.add(
      'inventario-estado--uso'
    );

    span.textContent =
      'En uso';

  }

  else if (
    estado === 'mantenimiento'
  ) {

    span.classList.add(
      'inventario-estado--mantenimiento'
    );

    span.textContent =
      'Mantenimiento';

  }

  else {

    span.classList.add(
      'inventario-estado--mantenimiento'
    );

    span.textContent =
      'No disponible';

  }

  return span;

}


/* =========================================================
   ESCAPAR HTML
========================================================= */

function escaparHTML(valor) {

  return String(valor ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

}


/* =========================================================
   CREAR MODAL
========================================================= */

function crearModal() {

  const modal =
    document.createElement('div');

  modal.className =
    'inventario-modal';

  modal.innerHTML = `

    <div
      class="inventario-modal__card"
      role="dialog"
      aria-modal="true"
    >

      <div class="inventario-modal__header">

        <div
          id="inventario-modal-titulo-contenedor"
          class="inventario-modal__titulo-contenedor"
        ></div>

        <button
          type="button"
          class="inventario-modal__cerrar"
          aria-label="Cerrar"
        >
          ×
        </button>

      </div>


      <div
        class="inventario-modal__contenido"
        id="inventario-modal-contenido"
      ></div>


      <div
        class="inventario-modal__footer"
        id="inventario-modal-footer"
      ></div>

    </div>

  `;


  document.body.appendChild(
    modal
  );


  /* Cerrar con X */

  modal
    .querySelector(
      '.inventario-modal__cerrar'
    )
    .addEventListener(
      'click',
      () => cerrarModal(modal)
    );


  /* Cerrar haciendo click fuera */

  modal.addEventListener(
    'click',
    (evento) => {

      if (
        evento.target === modal
      ) {

        cerrarModal(modal);

      }

    }
  );


  /* Cerrar con ESC */

  const cerrarConEscape =
    (evento) => {

      if (
        evento.key === 'Escape'
      ) {

        cerrarModal(modal);

      }

    };


  document.addEventListener(
    'keydown',
    cerrarConEscape
  );


  modal._cerrarConEscape =
    cerrarConEscape;


  return modal;

}


/* =========================================================
   CERRAR MODAL
========================================================= */

function cerrarModal(modal) {

  if (!modal) return;


  if (
    modal._cerrarConEscape
  ) {

    document.removeEventListener(
      'keydown',
      modal._cerrarConEscape
    );

  }


  modal.remove();

}


/* =========================================================
   TÍTULO DEL MODAL
========================================================= */

function ponerTituloModal(
  modal,
  icono,
  claseIcono,
  titulo,
  subtitulo
) {

  const contenedor =
    modal.querySelector(
      '#inventario-modal-titulo-contenedor'
    );


  contenedor.innerHTML = `

    <div
      class="inventario-modal__icono ${claseIcono}"
    >
      ${icono}
    </div>

    <div>

      <h2 class="inventario-modal__titulo">
        ${escaparHTML(titulo)}
      </h2>

      <p class="inventario-modal__subtitulo">
        ${escaparHTML(subtitulo)}
      </p>

    </div>

  `;

}


/* =========================================================
   CREAR BOTÓN DEL MODAL
========================================================= */

function crearBotonModal(
  texto,
  clase
) {

  const boton =
    document.createElement('button');

  boton.type =
    'button';

  boton.className =
    `inventario-modal__boton ${clase}`;

  boton.textContent =
    texto;

  return boton;

}


/* =========================================================
   MODAL VER
========================================================= */

function abrirModalVer(equipo) {

  const modal =
    crearModal();


  const nombre =
    equipo.nombre ||
    'Equipo';


  ponerTituloModal(
    modal,
    '👁',
    'inventario-modal__icono--ver',
    'Información del equipo',
    `Detalles de ${nombre}`
  );


  const categoria =
    equipo.categorias?.nombre ||
    'Sin categoría';


  const contenido =
    modal.querySelector(
      '#inventario-modal-contenido'
    );


  contenido.innerHTML = `

    <dl class="inventario-modal__datos">

      <div class="inventario-modal__dato">

        <dt>Clave</dt>

        <dd>
          ${escaparHTML(equipo.clave)}
        </dd>

      </div>


      <div class="inventario-modal__dato">

        <dt>Equipo</dt>

        <dd>
          ${escaparHTML(equipo.nombre)}
        </dd>

      </div>


      <div class="inventario-modal__dato">

        <dt>Categoría</dt>

        <dd>
          ${escaparHTML(categoria)}
        </dd>

      </div>


      <div class="inventario-modal__dato">

        <dt>Marca</dt>

        <dd>
          ${escaparHTML(equipo.marca)}
        </dd>

      </div>


      <div class="inventario-modal__dato">

        <dt>Modelo</dt>

        <dd>
          ${escaparHTML(equipo.modelo)}
        </dd>

      </div>


      <div class="inventario-modal__dato">

        <dt>Núm. de serie</dt>

        <dd>
          ${escaparHTML(equipo.numero_serie)}
        </dd>

      </div>


      <div class="inventario-modal__dato">

        <dt>Condición</dt>

        <dd>
          ${escaparHTML(
            obtenerCondicion(
              equipo.condicion
            )
          )}
        </dd>

      </div>


      <div class="inventario-modal__dato">

        <dt>Estado</dt>

        <dd>
          ${escaparHTML(
            textoEstado(equipo)
          )}
        </dd>

      </div>

    </dl>

  `;


  const footer =
    modal.querySelector(
      '#inventario-modal-footer'
    );


  const btnCerrar =
    crearBotonModal(
      'Cerrar',
      'inventario-modal__boton--cancelar'
    );


  btnCerrar.addEventListener(
    'click',
    () => cerrarModal(modal)
  );


  footer.appendChild(
    btnCerrar
  );

}


/* =========================================================
   MODAL EDITAR
========================================================= */

function abrirModalEditar(equipo) {

  const modal =
    crearModal();


  ponerTituloModal(
    modal,
    '✎',
    'inventario-modal__icono--editar',
    'Editar equipo',
    'Revisa la información antes de continuar'
  );


  const categoria =
    equipo.categorias?.nombre ||
    'Sin categoría';


  modal.querySelector(
    '#inventario-modal-contenido'
  ).innerHTML = `

    <dl class="inventario-modal__datos">

      <div class="inventario-modal__dato">

        <dt>Clave</dt>

        <dd>
          ${escaparHTML(equipo.clave)}
        </dd>

      </div>


      <div class="inventario-modal__dato">

        <dt>Equipo</dt>

        <dd>
          ${escaparHTML(equipo.nombre)}
        </dd>

      </div>


      <div class="inventario-modal__dato">

        <dt>Categoría</dt>

        <dd>
          ${escaparHTML(categoria)}
        </dd>

      </div>


      <div class="inventario-modal__dato">

        <dt>Marca</dt>

        <dd>
          ${escaparHTML(equipo.marca)}
        </dd>

      </div>


      <div class="inventario-modal__dato">

        <dt>Modelo</dt>

        <dd>
          ${escaparHTML(equipo.modelo)}
        </dd>

      </div>


      <div
        class="inventario-modal__dato inventario-modal__dato--completo"
      >

        <dt>Núm. de serie</dt>

        <dd>
          ${escaparHTML(equipo.numero_serie)}
        </dd>

      </div>

    </dl>

  `;


  const footer =
    modal.querySelector(
      '#inventario-modal-footer'
    );


  const btnCancelar =
    crearBotonModal(
      'Cancelar',
      'inventario-modal__boton--cancelar'
    );


  btnCancelar.addEventListener(
    'click',
    () => cerrarModal(modal)
  );


  const btnContinuar =
    crearBotonModal(
      'Editar equipo →',
      'inventario-modal__boton--principal'
    );


  btnContinuar.addEventListener(
    'click',
    () => {

      window.location.href =
        `/editar-equipo.html?id=${encodeURIComponent(
          equipo.id
        )}`;

    }
  );


  footer.appendChild(
    btnCancelar
  );

  footer.appendChild(
    btnContinuar
  );

}


/* =========================================================
   MODAL ELIMINAR
========================================================= */

function abrirModalEliminar(equipo) {

  const modal =
    crearModal();


  ponerTituloModal(
    modal,
    '🗑',
    'inventario-modal__icono--eliminar',
    'Eliminar equipo',
    'Esta acción requiere confirmación'
  );


  modal.querySelector(
    '#inventario-modal-contenido'
  ).innerHTML = `

    <p class="inventario-modal__mensaje">

      ¿Estás seguro de que deseas eliminar
      el equipo

      <strong>
        ${escaparHTML(equipo.nombre)}
      </strong>

      con clave

      <strong>
        ${escaparHTML(equipo.clave)}
      </strong>?

      <br><br>

      Esta acción eliminará el registro del
      inventario y no se puede deshacer.

    </p>

  `;


  const footer =
    modal.querySelector(
      '#inventario-modal-footer'
    );


  const btnCancelar =
    crearBotonModal(
      'Cancelar',
      'inventario-modal__boton--cancelar'
    );


  btnCancelar.addEventListener(
    'click',
    () => cerrarModal(modal)
  );


  const btnEliminar =
    crearBotonModal(
      'Eliminar equipo',
      'inventario-modal__boton--eliminar'
    );


  btnEliminar.addEventListener(
    'click',
    async () => {

      try {

        btnEliminar.disabled =
          true;

        btnEliminar.textContent =
          'Eliminando...';


        const {
          error
        } = await supabase
          .from('equipos')
          .delete()
          .eq(
            'id',
            equipo.id
          );


        if (error) {

          console.error(
            'Error al eliminar equipo:',
            error
          );


          window.alert(
            'No se pudo eliminar el equipo.\n\n' +
            error.message
          );


          btnEliminar.disabled =
            false;

          btnEliminar.textContent =
            'Eliminar equipo';

          return;

        }


        cerrarModal(modal);


        await cargarEquipos();

      }

      catch (error) {

        console.error(
          'Error inesperado:',
          error
        );


        window.alert(
          'Ocurrió un error al eliminar el equipo.'
        );


        btnEliminar.disabled =
          false;

        btnEliminar.textContent =
          'Eliminar equipo';

      }

    }
  );


  footer.appendChild(
    btnCancelar
  );

  footer.appendChild(
    btnEliminar
  );

}


/* =========================================================
   CREAR FILA
========================================================= */

function renderFila(equipo) {

  const tr =
    document.createElement('tr');


  /* CLAVE */

  tr.appendChild(
    celda(
      equipo.clave,
      'mono'
    )
  );


  /* EQUIPO */

  tr.appendChild(
    celda(
      equipo.nombre
    )
  );


  /* CATEGORÍA */

  tr.appendChild(
    celda(
      equipo.categorias?.nombre
    )
  );


  /* MARCA */

  tr.appendChild(
    celda(
      equipo.marca
    )
  );


  /* MODELO */

  tr.appendChild(
    celda(
      equipo.modelo
    )
  );


  /* NÚMERO DE SERIE */

  tr.appendChild(
    celda(
      equipo.numero_serie,
      'mono'
    )
  );


  /* CONDICIÓN */

  const tdCondicion =
    document.createElement('td');

  tdCondicion.textContent =
    obtenerCondicion(
      equipo.condicion
    );

  tr.appendChild(
    tdCondicion
  );


  /* ESTADO */

  const tdEstado =
    document.createElement('td');

  tdEstado.appendChild(
    crearEstado(equipo)
  );

  tr.appendChild(
    tdEstado
  );


  /* =======================================================
     ACCIONES
  ======================================================= */

  const tdAcciones =
    document.createElement('td');

  tdAcciones.className =
    'inventario-acciones';


  /* =======================================================
     EDITAR
  ======================================================= */

  const btnEditar =
    document.createElement('button');

  btnEditar.type =
    'button';

  btnEditar.className =
    'inventario-accion inventario-accion--editar';

  btnEditar.title =
    'Editar equipo';

  btnEditar.setAttribute(
    'aria-label',
    'Editar equipo'
  );

  btnEditar.innerHTML = `

    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >

      <path d="M12 20h9"></path>

      <path
        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"
      ></path>

    </svg>

  `;


  btnEditar.addEventListener(
    'click',
    () => {

      abrirModalEditar(
        equipo
      );

    }
  );


  /* =======================================================
     VER
  ======================================================= */

  const btnVer =
    document.createElement('button');

  btnVer.type =
    'button';

  btnVer.className =
    'inventario-accion inventario-accion--ver';

  btnVer.title =
    'Ver equipo';

  btnVer.setAttribute(
    'aria-label',
    'Ver equipo'
  );

  btnVer.innerHTML = `

    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >

      <path
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
      ></path>

      <circle
        cx="12"
        cy="12"
        r="3"
      ></circle>

    </svg>

  `;


  btnVer.addEventListener(
    'click',
    () => {

      abrirModalVer(
        equipo
      );

    }
  );


  /* =======================================================
     ELIMINAR
  ======================================================= */

  const btnEliminar =
    document.createElement('button');

  btnEliminar.type =
    'button';

  btnEliminar.className =
    'inventario-accion inventario-accion--eliminar';

  btnEliminar.title =
    'Eliminar equipo';

  btnEliminar.setAttribute(
    'aria-label',
    'Eliminar equipo'
  );

  btnEliminar.innerHTML = `

    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >

      <path d="M3 6h18"></path>

      <path d="M8 6V4h8v2"></path>

      <path d="M19 6l-1 14H6L5 6"></path>

      <path d="M10 11v5"></path>

      <path d="M14 11v5"></path>

    </svg>

  `;


  btnEliminar.addEventListener(
    'click',
    () => {

      abrirModalEliminar(
        equipo
      );

    }
  );


  /* AGREGAR BOTONES */

  tdAcciones.appendChild(
    btnEditar
  );

  tdAcciones.appendChild(
    btnVer
  );

  tdAcciones.appendChild(
    btnEliminar
  );


  tr.appendChild(
    tdAcciones
  );


  return tr;

}


/* =========================================================
   FILTROS
========================================================= */

function aplicarFiltros() {

  const termino =
    inputBuscar.value
      .trim()
      .toLowerCase();


  const categoriaId =
    selectCategoria.value;


  const disponibilidad =
    selectDisponibilidad
      ? selectDisponibilidad.value
      : '';


  const filtrados =
    equiposCache.filter(
      (equipo) => {

        /* CATEGORÍA */

        const coincideCategoria =
          !categoriaId ||
          String(equipo.categoria_id) ===
          String(categoriaId);


        /* BUSCADOR */

        const texto = [

          equipo.clave,
          equipo.nombre,
          equipo.marca,
          equipo.modelo,
          equipo.numero_serie

        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();


        const coincideBusqueda =
          !termino ||
          texto.includes(termino);


        /* DISPONIBILIDAD */

        let coincideDisponibilidad =
          true;


        if (
          disponibilidad
        ) {

          const estado =
            obtenerEstado(equipo);


          if (
            disponibilidad ===
            'disponible'
          ) {

            coincideDisponibilidad =
              estado === 'disponible';

          }

          else if (
            disponibilidad ===
            'no-disponible'
          ) {

            coincideDisponibilidad =
              estado !== 'disponible';

          }

        }


        return (
          coincideCategoria &&
          coincideBusqueda &&
          coincideDisponibilidad
        );

      }
    );


  /* LIMPIAR TABLA */

  tbody.innerHTML =
    '';


  /* CREAR FILAS */

  filtrados.forEach(
    (equipo) => {

      tbody.appendChild(
        renderFila(equipo)
      );

    }
  );


  /* CONTADORES */

  contador.textContent =
    `${filtrados.length} resultado${
      filtrados.length === 1
        ? ''
        : 's'
    }`;


  if (
    contadorFinal
  ) {

    contadorFinal.textContent =
      `${filtrados.length} de ${equiposCache.length} equipos`;

  }


  /* ESTADO DE LA PÁGINA */

  if (
    equiposCache.length === 0
  ) {

    mostrarSoloEstado(
      'vacio'
    );

    return;

  }


  mostrarSoloEstado(
    'con-datos'
  );


  /* SIN RESULTADOS */

  if (
    elSinResultados
  ) {

    elSinResultados.classList.toggle(
      'oculto',
      filtrados.length > 0
    );

  }

}


/* =========================================================
   CARGAR CATEGORÍAS
========================================================= */

async function cargarCategorias() {

  const {
    data,
    error
  } = await supabase
    .from('categorias')
    .select(
      'id, nombre'
    )
    .order(
      'nombre',
      {
        ascending: true
      }
    );


  if (
    error
  ) {

    console.error(
      'Error al cargar categorías:',
      error
    );

    return;

  }


  (data ?? []).forEach(
    (categoria) => {

      const option =
        document.createElement(
          'option'
        );


      option.value =
        categoria.id;


      option.textContent =
        categoria.nombre;


      selectCategoria.appendChild(
        option
      );

    }
  );

}


/* =========================================================
   CARGAR EQUIPOS
========================================================= */

async function cargarEquipos() {

  mostrarSoloEstado(
    'cargando'
  );


  const {
    data,
    error
  } = await supabase
    .from('equipos')
    .select(`
      id,
      clave,
      nombre,
      categoria_id,
      marca,
      modelo,
      numero_serie,
      condicion,
      activo,
      categorias(nombre)
    `)
    .order(
      'clave',
      {
        ascending: true
      }
    );


  if (
    error
  ) {

    console.error(
      'Error al cargar equipos:',
      error
    );

    mostrarSoloEstado(
      'error'
    );

    return;

  }


  equiposCache =
    data ?? [];


  aplicarFiltros();

}


/* =========================================================
   EVENTOS
========================================================= */

inputBuscar.addEventListener(
  'input',
  aplicarFiltros
);


selectCategoria.addEventListener(
  'change',
  aplicarFiltros
);


if (
  selectDisponibilidad
) {

  selectDisponibilidad.addEventListener(
    'change',
    aplicarFiltros
  );

}


if (
  btnReintentar
) {

  btnReintentar.addEventListener(
    'click',
    cargarEquipos
  );

}


/* =========================================================
   INICIO
========================================================= */

cargarCategorias();

cargarEquipos();