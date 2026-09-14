# RIDER — Sistema de gestión de eventos audiovisuales

Aplicación web progresiva para una empresa de producción de eventos audiovisuales. Gestiona inventario de equipo, clientes, cuadrillas y eventos, con validación de disponibilidad para evitar que el mismo equipo se comprometa en dos eventos que se traslapan. Funciona sin conexión para el técnico de campo, con sincronización manual al recuperar señal.

> Proyecto Integrador · Equipo #4 · Programación de Aplicaciones Web Progresivas
> Ingeniería en Entornos Virtuales y Negocios Digitales · Décimo cuatrimestre
> Universidad Tecnológica de Bahía de Banderas 

---

## Integrantes y módulos

| Integrante | Módulo | Responsabilidad |
| Andrés González | 1 — Inventario de equipo | `equipos`, `categorias`. CRUD completo, ficha de equipo con disponibilidad, reporte de utilización.
| Kevin Mejia | 2 — Eventos | `eventos`. Flujo de estados y validación de traslape (equipo comprometido). 
| Emiliano Manrique | 3 — Clientes, cuadrilla y hoja de carga | `clientes`, `usuarios`, `evento_equipo`, `evento_personal`. Autenticación y permisos por rol. 

---

## Modelo de datos

Siete tablas: `usuarios`, `clientes`, `categorias`, `equipos`, `eventos`, `evento_equipo`, `evento_personal`. Es el modelo que los tres módulos comparten — ningún módulo diseña su parte del esquema por separado.

📄 Ver [`MODELO_ENTIDAD_RELACION.md`](./MODELO_ENTIDAD_RELACION.md) para el diagrama completo y las notas de diseño.

---

## Flujo de estados del evento

```
cotizado ──► confirmado ──► en montaje ──► cerrado
    │             │
    └─────────────┴──► cancelado
```

Reglas clave validadas por el sistema:
- No se confirma sin cliente, sede y las tres fechas.
- No se confirma si algún equipo ya está comprometido en otro evento **confirmado** con fechas que se traslapan.
- No pasa a *en montaje* sin equipo y cuadrilla asignados.
- No se cierra con piezas sin retorno registrado.
- Solo el coordinador cancela, y exige motivo.

---

## Decisiones del equipo (sección 10 del documento del proyecto)

Resumen de las cuatro decisiones que cambian el modelo de datos y la lógica de validación. 

1. **Inventario:** por pieza, con número de serie individual — para mantener trazabilidad de qué pieza específica se dañó.
2. **Traslape:** la ventana comprometida de un evento va de `fecha_montaje` a `fecha_fin`, sin margen adicional. Dos eventos traslapan si `montaje_A < fin_B` y `montaje_B < fin_A`.
3. **Confirmaciones simultáneas:** la validación de traslape se repite en el servidor dentro de una transacción; el servidor es la única fuente de verdad, no el estado que tenía el navegador al cargar la pantalla.
4. **Retorno sin señal + reasignación:** si el equipo fue reasignado mientras el técnico estaba offline, el retorno sincronizado se marca como conflicto pendiente de revisión en vez de aplicarse en automático; lo resuelve el coordinador manualmente.

---

## Tablero y backlog

🔗 **GitHub Projects:**

El tablero tiene 4 columnas (Por hacer / En progreso / En revisión / Hecho), con campos de Módulo e Iteration (Sprint 1–4) por historia. El backlog inicial (sección 9 del documento) está cargado ahí con responsable asignado.

---

## Definition of Done

Ver [`Definition_of_done.md`](./Definition_of_done.md).

---

## Fuera de alcance

Este proyecto no incluye: cotizaciones con precios/facturación, códigos QR/barras, fotografías, calendario tipo Gantt, logística de traslado, firma del cliente, notificaciones, sincronización automática en segundo plano, órdenes de reparación, ni portal para el cliente.
