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
// CÁLCULO DE DÍAS COMPROMETIDOS
// =====================================================

// Convierte una fecha YYYY-MM-DD a un número de día,
// evitando problemas por zonas horarias.
function convertirFechaADias(fecha) {
  if (!fecha) return null;

  const fechaTexto = String(fecha).slice(0, 10);
  const partes = fechaTexto.split('-').map(Number);

  if (partes.length !== 3 || partes.some(Number.isNaN)) {
    return null;
  }

  const [anio, mes, dia] = partes;
  const fechaUTC = Date.UTC(anio, mes - 1, dia);

  const comprobacion = new Date(fechaUTC);

  if (
    comprobacion.getUTCFullYear() !== anio ||
    comprobacion.getUTCMonth() !== mes - 1 ||
    comprobacion.getUTCDate() !== dia
  ) {
    return null;
  }

  return Math.floor(fechaUTC / 86400000);
}

// Cuenta los días incluyendo el día de montaje y el día final.
function contarDiasComprometidos(fechaMontaje, fechaFin) {
  const inicio = convertirFechaADias(fechaMontaje);
  const fin = convertirFechaADias(fechaFin);

  if (inicio === null || fin === null || fin < inicio) {
    return 0;
  }

  return fin - inicio + 1;
}

// Obtiene el evento relacionado con una asignación.
function obtenerEventoAsignacion(asignacion) {
  const evento = asignacion.eventos;

  return Array.isArray(evento) ? evento[0] : evento;
}

// Solo cuentan los eventos que realmente comprometieron equipo.
function eventoValido(evento) {
  if (!evento) return false;

  const estado = normalizar(evento.estado);

  return [
    'confirmado',
    'en montaje',
    'en_montaje',
    'cerrado'
  ].includes(estado);
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
  .select(`
    equipo_id,
    evento_id,
    salida_registrada,
    retorno_registrado,
    condicion_retorno,
    eventos (
      id,
      fecha_montaje,
      fecha_inicio,
      fecha_fin,
      estado
    )
  `);

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
// OBTENER PERIODO DEL REPORTE
// =====================================================

function obtenerPeriodoReporte() {
  const fechaInicioFiltro =
    $('reporte-fecha-inicio')?.value || '';

  const fechaFinFiltro =
    $('reporte-fecha-fin')?.value || '';

  const fechasEventos = asignaciones
    .map((asignacion) => obtenerEventoAsignacion(asignacion))
    .filter(eventoValido)
    .map((evento) => ({
      inicio: convertirFechaADias(evento.fecha_montaje),
      fin: convertirFechaADias(evento.fecha_fin)
    }))
    .filter(({ inicio, fin }) =>
      inicio !== null &&
      fin !== null &&
      fin >= inicio
    );

  const inicioMinimo = fechasEventos.length
    ? Math.min(...fechasEventos.map((fecha) => fecha.inicio))
    : null;

  const finMaximo = fechasEventos.length
    ? Math.max(...fechasEventos.map((fecha) => fecha.fin))
    : null;

  const inicioSeleccionado = fechaInicioFiltro
    ? convertirFechaADias(fechaInicioFiltro)
    : inicioMinimo;

  const finSeleccionado = fechaFinFiltro
    ? convertirFechaADias(fechaFinFiltro)
    : finMaximo;

  if (
    inicioSeleccionado === null ||
    finSeleccionado === null ||
    finSeleccionado < inicioSeleccionado
  ) {
    return null;
  }

  return {
    inicio: inicioSeleccionado,
    fin: finSeleccionado,
    dias: finSeleccionado - inicioSeleccionado + 1
  };
}

// =====================================================
// OBTENER MÉTRICAS DE UTILIZACIÓN POR EQUIPO
// =====================================================

function obtenerMetricasEquipo(equipoId, periodo) {
  const eventosContados = new Set();

  let diasComprometidos = 0;
  let equiposDanados = 0;
  let equiposFaltantes = 0;
  let equiposBuenEstado = 0;
  let equiposPendientes = 0;

  const registros = asignaciones.filter((asignacion) =>
    String(asignacion.equipo_id) === String(equipoId)
  );

  registros.forEach((asignacion) => {
    const evento = obtenerEventoAsignacion(asignacion);

    // Excluir eventos cotizados y cancelados.
    if (!eventoValido(evento)) return;

    const inicioEvento = convertirFechaADias(evento.fecha_montaje);
    const finEvento = convertirFechaADias(evento.fecha_fin);

    if (
      inicioEvento === null ||
      finEvento === null ||
      finEvento < inicioEvento
    ) {
      return;
    }

    // Calcular la intersección entre el evento y el periodo.
    const inicio = Math.max(inicioEvento, periodo.inicio);
    const fin = Math.min(finEvento, periodo.fin);

    if (fin < inicio) return;

    const eventoId = String(evento.id ?? asignacion.evento_id);

    // Evitar contar dos veces el mismo evento para el equipo.
    if (eventosContados.has(eventoId)) return;

    eventosContados.add(eventoId);

    // Contar días incluyendo montaje y finalización.
    diasComprometidos += fin - inicio + 1;

    // Las condiciones de retorno solo cuentan en eventos cerrados.
    if (normalizar(evento.estado) !== 'cerrado') return;

    const condicion = normalizar(asignacion.condicion_retorno);

    // Identificar retornos cerrados sin condición registrada.
    if (!condicion) {
      equiposPendientes++;
      return;
    }

    if (condicion === 'dañado' || condicion === 'danado') {
      equiposDanados++;
    }

    if (condicion === 'faltante') {
      equiposFaltantes++;
    }

    if (
      condicion === 'buen_estado' ||
      condicion === 'buen estado'
    ) {
      equiposBuenEstado++;
    }
  });

  return {
    eventos: eventosContados.size,
    diasComprometidos,
    danados: equiposDanados,
    faltantes: equiposFaltantes,
    buenos: equiposBuenEstado,
    pendientes: equiposPendientes
  };
}

// =====================================================
// ACTUALIZAR RESUMEN
// =====================================================



function mostrarReporte() {
  const resultados = obtenerResultadosFiltrados();
  const total = resultados.length;
  const periodo = obtenerPeriodoReporte();

  let totalDiasComprometidos = 0;
  let totalAsignaciones = 0;
  let equiposSinUso = 0;

  if (!errorAsignaciones && periodo) {
    resultados.forEach((equipo) => {
      const metricas = obtenerMetricasEquipo(equipo.id, periodo);

      totalDiasComprometidos += metricas.diasComprometidos;
      totalAsignaciones += metricas.eventos;

      if (metricas.eventos === 0) {
        equiposSinUso++;
      }
    });
  }

  const capacidadTotal = periodo
    ? periodo.dias * total
    : 0;

  const tasaUtilizacion =
    !errorAsignaciones && capacidadTotal > 0
      ? (totalDiasComprometidos / capacidadTotal) * 100
      : 0;

  actualizarTexto('total-equipos', total);

  actualizarTexto(
    'total-horas',
    errorAsignaciones || !periodo
      ? 'N/D'
      : totalAsignaciones
  );

  actualizarTexto(
    'porcentaje-utilizacion',
    errorAsignaciones || !periodo
      ? 'N/D'
      : `${tasaUtilizacion.toFixed(1)}%`
  );

  actualizarTexto(
    'equipos-mas-utilizados',
    errorAsignaciones || !periodo
      ? 'N/D'
      : equiposSinUso
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
        <td colspan="8" class="reporte__vacio">
          No hay equipos que coincidan con los filtros.
        </td>
      </tr>
    `;
    return;
  }

  const periodo = obtenerPeriodoReporte();

  const ordenados = [...resultados].sort((a, b) => {
    if (errorAsignaciones || !periodo) return 0;

    const metricasA = obtenerMetricasEquipo(a.id, periodo);
    const metricasB = obtenerMetricasEquipo(b.id, periodo);

    return metricasB.diasComprometidos -
      metricasA.diasComprometidos;
  });

  tabla.innerHTML = ordenados.map((equipo) => {
    const metricas = !errorAsignaciones && periodo
      ? obtenerMetricasEquipo(equipo.id, periodo)
      : null;

    const eventos = metricas?.eventos ?? 'N/D';
    const dias = metricas?.diasComprometidos ?? 'N/D';

    const porcentaje = metricas && periodo.dias > 0
      ? `${(
          (metricas.diasComprometidos / periodo.dias) * 100
        ).toFixed(1)}%`
      : 'N/D';

    const uso = metricas
      ? metricas.eventos > 0
        ? 'Utilizado'
        : 'Sin uso'
      : 'No disponible';

    const claseUso = metricas
      ? metricas.eventos > 0
        ? 'reporte__estado--uso'
        : 'reporte__estado--sin-uso'
      : '';

    let condicionRetorno = 'Sin registro';

    if (metricas) {
      const condiciones = [];

      if (metricas.danados > 0) {
        condiciones.push(`Dañado: ${metricas.danados}`);
      }

      if (metricas.faltantes > 0) {
        condiciones.push(`Faltante: ${metricas.faltantes}`);
      }

      if (metricas.buenos > 0) {
        condiciones.push(`Buen estado: ${metricas.buenos}`);
      }

      if (metricas.pendientes > 0) {
        condiciones.push(
          `Pendiente de condición: ${metricas.pendientes}`
        );
      }

      if (condiciones.length > 0) {
        condicionRetorno = condiciones.join(' | ');
      }
    }

    return `
      <tr>
        <td>${escapar(equipo.clave || '—')}</td>

        <td>
          <strong>${escapar(equipo.nombre || 'Sin nombre')}</strong>
        </td>

        <td>${escapar(obtenerNombreCategoria(equipo))}</td>

        <td>${eventos}</td>

        <td>${dias}</td>

        <td>${porcentaje}</td>

        <td>
          <span class="reporte__estado ${claseUso}">
            ${uso}
          </span>
        </td>

        <td>${escapar(condicionRetorno)}</td>
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

  const periodo = obtenerPeriodoReporte();

  const filas = resultados.map((equipo) => {
    let eventos = 'N/D';
    let dias = 'N/D';
    let utilizacion = 'N/D';
    let uso = 'No disponible';
    let condicionRetorno = 'N/D';

    if (!errorAsignaciones && periodo) {
      const metricas = obtenerMetricasEquipo(
        equipo.id,
        periodo
      );

      eventos = metricas.eventos;
      dias = metricas.diasComprometidos;

      const porcentaje = periodo.dias > 0
        ? (metricas.diasComprometidos / periodo.dias) * 100
        : 0;

      utilizacion = `${porcentaje.toFixed(1)}%`;

      uso = metricas.eventos > 0
        ? 'Utilizado'
        : 'Sin uso';

      const condiciones = [];

      if (metricas.buenos > 0) {
        condiciones.push(`Buen estado: ${metricas.buenos}`);
      }

      if (metricas.danados > 0) {
        condiciones.push(`Dañado: ${metricas.danados}`);
      }

      if (metricas.faltantes > 0) {
        condiciones.push(`Faltante: ${metricas.faltantes}`);
      }

      condicionRetorno = condiciones.length > 0
        ? condiciones.join(' | ')
        : 'Sin registro';
    }

    return `
      <tr>
        <td>${escapar(equipo.clave || '—')}</td>
        <td>${escapar(equipo.nombre || 'Sin nombre')}</td>
        <td>${escapar(obtenerNombreCategoria(equipo))}</td>
        <td>${eventos}</td>
        <td>${dias}</td>
        <td>${utilizacion}</td>
        <td>${escapar(uso)}</td>
        <td>${escapar(condicionRetorno)}</td>
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
          font-size: 10px;
        }

        thead {
          display: table-header-group;
        }

        th {
          padding: 10px 7px;
          background: #161822;
          color: #ffffff;
          text-align: left;
        }

        td {
          padding: 9px 7px;
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
            <th>Eventos</th>
            <th>Días comprometidos</th>
            <th>Utilización del periodo</th>
            <th>Uso</th>
            <th>Condición de retorno</th>
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
      'Filtros de equipo, categoría, estado y periodo aplicados correctamente.'
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
