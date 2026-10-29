import { supabase } from './supabaseClient.js';

// =====================================================
// VARIABLES
// =====================================================

const $ = (id) => document.getElementById(id);

let equipos = [];
let categorias = [];
let asignaciones = [];
let errorAsignaciones = false;

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

function normalizar(valor) {
  return String(valor ?? '').trim().toLowerCase();
}

function escapar(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (caracter) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[caracter]);
}

function estaActivo(equipo) {
  return (
    equipo.activo === true ||
    equipo.activo === 1 ||
    equipo.activo === 'true' ||
    equipo.activo === '1'
  );
}

function obtenerCategoria(equipo) {
  return categorias.find((categoria) =>
    String(categoria.id) === String(equipo.categoria_id)
  );
}

function obtenerNombreCategoria(equipo) {
  return obtenerCategoria(equipo)?.nombre || 'Sin categoría';
}

function contarAsignaciones(equipoId) {
  return asignaciones.filter((asignacion) =>
    String(asignacion.equipo_id) === String(equipoId)
  ).length;
}

function actualizarTexto(id, valor) {
  const elemento = $(id);

  if (elemento) {
    elemento.textContent = valor;
  }
}

// =====================================================
// CARGAR INFORMACIÓN DE SUPABASE
// =====================================================

async function cargarReporte() {
  actualizarTexto('mensaje-reporte', 'Cargando información...');

  const tabla = $('filas-reporte');

  if (tabla) {
    tabla.innerHTML = `
      <tr>
        <td colspan="6" class="reporte__vacio">
          Cargando equipos...
        </td>
      </tr>
    `;
  }

  try {
    const [respuestaEquipos, respuestaCategorias] =
      await Promise.all([
        supabase
          .from('equipos')
          .select(`
            id,
            clave,
            nombre,
            categoria_id,
            marca,
            modelo,
            condicion,
            activo
          `),

        supabase
          .from('categorias')
          .select('id, nombre')
      ]);

    if (respuestaEquipos.error) {
      throw respuestaEquipos.error;
    }

    if (respuestaCategorias.error) {
      throw respuestaCategorias.error;
    }

    equipos = respuestaEquipos.data || [];
    categorias = respuestaCategorias.data || [];

    const respuestaAsignaciones = await supabase
      .from('evento_equipo')
      .select('equipo_id');

    if (respuestaAsignaciones.error) {
      console.error(
        'Error al consultar asignaciones:',
        respuestaAsignaciones.error
      );

      asignaciones = [];
      errorAsignaciones = true;
    } else {
      asignaciones = respuestaAsignaciones.data || [];
      errorAsignaciones = false;
    }

    cargarCategorias();
    mostrarReporte();

    actualizarTexto(
      'mensaje-reporte',
      errorAsignaciones
        ? 'Equipos cargados. No se pudieron consultar las asignaciones.'
        : 'Reporte actualizado correctamente.'
    );

  } catch (error) {
    console.error('Error al cargar reporte:', error);

    actualizarTexto(
      'mensaje-reporte',
      'No se pudo cargar el reporte. Revisa la conexión con Supabase.'
    );

    if (tabla) {
      tabla.innerHTML = `
        <tr>
          <td colspan="6" class="reporte__vacio">
            Error al consultar los datos.
          </td>
        </tr>
      `;
    }

    actualizarTexto('total-equipos', '—');
    actualizarTexto('total-horas', '—');
    actualizarTexto('porcentaje-utilizacion', '—');
    actualizarTexto('equipos-mas-utilizados', '—');
    actualizarTexto('cantidad-resultados', '—');
  }
}

// =====================================================
// CARGAR CATEGORÍAS
// =====================================================

function cargarCategorias() {
  const select = $('reporte-filtro-categoria');

  if (!select) return;

  const seleccionAnterior = select.value;

  select.innerHTML =
    '<option value="">Todas las categorías</option>';

  categorias.forEach((categoria) => {
    const opcion = document.createElement('option');

    opcion.value = String(categoria.id);
    opcion.textContent = categoria.nombre || 'Sin nombre';

    select.appendChild(opcion);
  });

  select.value = [...select.options].some(
    (opcion) => opcion.value === seleccionAnterior
  )
    ? seleccionAnterior
    : '';
}

// =====================================================
// APLICAR FILTROS
// =====================================================

function obtenerResultadosFiltrados() {
  const busqueda = normalizar(
    $('reporte-buscar-equipo')?.value
  );

  const categoriaSeleccionada =
    $('reporte-filtro-categoria')?.value || '';

  const estadoSeleccionado =
    $('reporte-filtro-estado')?.value || '';

  return equipos.filter((equipo) => {
    const textoEquipo = normalizar([
      equipo.clave,
      equipo.nombre,
      equipo.marca,
      equipo.modelo
    ].join(' '));

    const coincideBusqueda =
      textoEquipo.includes(busqueda);

    const coincideCategoria =
      !categoriaSeleccionada ||
      String(equipo.categoria_id) === categoriaSeleccionada;

    const activo = estaActivo(equipo);

    const coincideEstado =
      !estadoSeleccionado ||
      (estadoSeleccionado === 'activo' && activo) ||
      (estadoSeleccionado === 'inactivo' && !activo);

    return (
      coincideBusqueda &&
      coincideCategoria &&
      coincideEstado
    );
  });
}

// =====================================================
// ACTUALIZAR RESUMEN
// =====================================================

function mostrarReporte() {
  const resultados = obtenerResultadosFiltrados();
  const total = resultados.length;

  const activos = resultados.filter(
    (equipo) => estaActivo(equipo)
  ).length;

  const equiposConAsignaciones = resultados.filter(
    (equipo) => contarAsignaciones(equipo.id) > 0
  ).length;

  const equiposSinAsignaciones =
    total - equiposConAsignaciones;

  const tasaActivos = total > 0
    ? (activos / total) * 100
    : 0;

  actualizarTexto('total-equipos', total);

  // No se inventan horas de utilización.
  actualizarTexto('total-horas', 'N/D');

  actualizarTexto(
    'porcentaje-utilizacion',
    `${tasaActivos.toFixed(1)}%`
  );

  actualizarTexto(
    'equipos-mas-utilizados',
    errorAsignaciones
      ? 'N/D'
      : equiposSinAsignaciones
  );

  actualizarTexto(
    'cantidad-resultados',
    `${total} equipo${total === 1 ? '' : 's'}`
  );

  dibujarTabla(resultados);
}

// =====================================================
// DIBUJAR TABLA
// =====================================================

function dibujarTabla(resultados) {
  const tabla = $('filas-reporte');

  if (!tabla) return;

  if (resultados.length === 0) {
    tabla.innerHTML = `
      <tr>
        <td colspan="6" class="reporte__vacio">
          No hay equipos que coincidan con los filtros.
        </td>
      </tr>
    `;

    return;
  }

  const ordenados = [...resultados].sort(
    (a, b) =>
      contarAsignaciones(b.id) -
      contarAsignaciones(a.id)
  );

  tabla.innerHTML = ordenados.map((equipo) => {
    const activo = estaActivo(equipo);

    const cantidad = errorAsignaciones
      ? null
      : contarAsignaciones(equipo.id);

    const textoUso = cantidad === null
      ? 'No disponible'
      : cantidad > 0
        ? 'Con asignaciones'
        : 'Sin uso registrado';

    const claseUso = cantidad === null
      ? ''
      : cantidad > 0
        ? 'reporte__estado--uso'
        : 'reporte__estado--sin-uso';

    return `
      <tr>
        <td>${escapar(equipo.clave || '—')}</td>

        <td>
          <strong>${escapar(equipo.nombre || 'Sin nombre')}</strong>
        </td>

        <td>${escapar(obtenerNombreCategoria(equipo))}</td>

        <td>${cantidad === null ? 'N/D' : cantidad}</td>

        <td>
          <span class="reporte__estado ${claseUso}">
            ${textoUso}
          </span>
        </td>

        <td>
          <span class="reporte__estado ${
            activo
              ? 'reporte__estado--activo'
              : 'reporte__estado--inactivo'
          }">
            ${activo ? 'Activo' : 'Inactivo'}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

// =====================================================
// EXPORTAR REPORTE A PDF
// =====================================================

function exportarPDF() {
  const resultados = obtenerResultadosFiltrados();

  if (resultados.length === 0) {
    actualizarTexto(
      'mensaje-reporte',
      'No hay equipos para exportar con los filtros actuales.'
    );
    return;
  }

  const filas = resultados.map((equipo) => {
    const cantidad = errorAsignaciones
      ? 'N/D'
      : contarAsignaciones(equipo.id);

    const uso = errorAsignaciones
      ? 'No disponible'
      : cantidad > 0
        ? 'Con asignaciones'
        : 'Sin asignaciones';

    return `
      <tr>
        <td>${escapar(equipo.clave || '—')}</td>
        <td>${escapar(equipo.nombre || 'Sin nombre')}</td>
        <td>${escapar(obtenerNombreCategoria(equipo))}</td>
        <td>${cantidad}</td>
        <td>${escapar(uso)}</td>
        <td>${estaActivo(equipo) ? 'Activo' : 'Inactivo'}</td>
      </tr>
    `;
  }).join('');

  const ventana = window.open('', '_blank');

  if (!ventana) {
    actualizarTexto(
      'mensaje-reporte',
      'Permite las ventanas emergentes del navegador para generar el PDF.'
    );
    return;
  }

  const fecha = new Date().toLocaleDateString('es-MX');

  ventana.document.open();

  ventana.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>RIDER - Reporte de utilización</title>

      <style>
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          padding: 32px;
          font-family: Arial, Helvetica, sans-serif;
          color: #202b3c;
          background: #ffffff;
        }

        header {
          padding-bottom: 18px;
          margin-bottom: 24px;
          border-bottom: 3px solid #6366f1;
        }

        .marca {
          margin: 0 0 8px;
          color: #6366f1;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 3px;
        }

        h1 {
          margin: 0 0 8px;
          font-size: 26px;
        }

        .descripcion {
          margin: 0;
          color: #64748b;
          font-size: 13px;
        }

        .datos {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
          color: #475569;
          font-size: 12px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }

        thead {
          display: table-header-group;
        }

        th {
          padding: 11px 8px;
          background: #161822;
          color: #ffffff;
          text-align: left;
        }

        td {
          padding: 9px 8px;
          border-bottom: 1px solid #e2e8f0;
          text-align: left;
          overflow-wrap: anywhere;
        }

        tbody tr:nth-child(even) {
          background: #f4f6fb;
        }

        tr {
          page-break-inside: avoid;
        }

        footer {
          margin-top: 22px;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
          color: #64748b;
          font-size: 10px;
        }

        @page {
          size: landscape;
          margin: 12mm;
        }

        @media print {
          body {
            padding: 0;
          }
        }
      </style>
    </head>

    <body>
      <header>
        <p class="marca">RIDER</p>
        <h1>Reporte de utilización</h1>
        <p class="descripcion">
          Inventario de equipos audiovisuales
        </p>
      </header>

      <div class="datos">
        <span>Fecha de generación: ${escapar(fecha)}</span>
        <span>Total de equipos: ${resultados.length}</span>
      </div>

      <table>
        <thead>
          <tr>
            <th>Clave</th>
            <th>Equipo</th>
            <th>Categoría</th>
            <th>Asignaciones</th>
            <th>Utilización</th>
            <th>Estado</th>
          </tr>
        </thead>

        <tbody>
          ${filas}
        </tbody>
      </table>

      <footer>
        Reporte generado desde el sistema de inventario RIDER.
        Los datos corresponden a los filtros seleccionados.
      </footer>

      <script>
        window.onload = function () {
          window.focus();
          window.print();
        };
      <\/script>
    </body>
    </html>
  `);

  ventana.document.close();
}

// =====================================================
// EVENTOS DE LOS CONTROLES
// =====================================================

$('btn-filtrar')?.addEventListener('click', () => {
  const fechaInicio = $('reporte-fecha-inicio')?.value;
  const fechaFin = $('reporte-fecha-fin')?.value;

  if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
    actualizarTexto(
      'mensaje-reporte',
      'La fecha inicial no puede ser posterior a la fecha final.'
    );
    return;
  }

  mostrarReporte();

  if (fechaInicio || fechaFin) {
    actualizarTexto(
      'mensaje-reporte',
      'Se aplicaron los filtros de equipo, categoría y estado. El filtro por fechas requiere vincular las columnas de fecha de Supabase.'
    );
  } else {
    actualizarTexto(
      'mensaje-reporte',
      'Filtros aplicados correctamente.'
    );
  }
});

$('btn-actualizar')?.addEventListener(
  'click',
  cargarReporte
);

$('btn-exportar')?.addEventListener(
  'click',
  exportarPDF
);

$('reporte-buscar-equipo')?.addEventListener(
  'input',
  mostrarReporte
);

$('reporte-filtro-categoria')?.addEventListener(
  'change',
  mostrarReporte
);

$('reporte-filtro-estado')?.addEventListener(
  'change',
  mostrarReporte
);

// =====================================================
// INICIALIZAR REPORTE
// =====================================================

cargarReporte();
