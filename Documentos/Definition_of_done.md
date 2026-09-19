# RIDER — Sistema de gestión de eventos audiovisuales

Aplicación web progresiva para una empresa de producción de eventos audiovisuales. Gestiona inventario de equipo, clientes, cuadrillas y eventos, con validación de disponibilidad para evitar que el mismo equipo se comprometa en dos eventos que se traslapan. Funciona sin conexión para el técnico de campo, con sincronización manual al recuperar señal.

> Proyecto Integrador · Equipo #4 · Programación de Aplicaciones Web Progresivas
> Ingeniería en Entornos Virtuales y Negocios Digitales · Décimo cuatrimestre
> Universidad Tecnológica de Bahía de Banderas · Periodo 1 sept. – 4 dic. 2026

---

## Enlace al despliegue

🔗 **URL de producción:** _[pendiente — pegar aquí en cuanto esté desplegado]_

⚠️ Solo se acepta como entregado lo que funcione en esta dirección publicada, no lo que solo corre en local.

---

## Integrantes y módulos

| Integrante | Módulo | Responsabilidad |
|---|---|---|
| _[nombre]_ | 1 — Inventario de equipo | `equipos`, `categorias`. CRUD completo, ficha de equipo con disponibilidad. |
| _[nombre]_ | 2 — Eventos | `eventos`. Flujo de estados y validación de traslape (equipo comprometido). |
| _[nombre]_ | 3 — Clientes, cuadrilla y hoja de carga | `clientes`, `usuarios`, `evento_equipo`, `evento_personal`. Autenticación y permisos por rol. |

---

## Stack tecnológico

- **Frontend:** _[framework / librería]_
- **Backend:** _[framework / lenguaje]_
- **Base de datos:** _[motor]_
- **PWA / offline:** _[Service Worker, IndexedDB u otro mecanismo de almacenamiento local]_
- **Autenticación:** _[mecanismo]_
- **Hosting / despliegue:** _[plataforma]_

---

## Cómo correrlo en local

```bash
# Clonar el repositorio
git clone <url-del-repo>
cd <carpeta-del-proyecto>

# Instalar dependencias
_[comando]_

# Variables de entorno
# Copiar .env.example a .env y completar:
# - _[variable_1]_
# - _[variable_2]_

# Levantar el proyecto
_[comando]_
```

---

## Modelo de datos

Diagrama entidad-relación de las 7 tablas (`usuarios`, `clientes`, `categorias`, `equipos`, `eventos`, `evento_equipo`, `evento_personal`):

🔗 _[enlace al diagrama, o imagen embebida aquí]_

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

Estas decisiones cambian el modelo de datos y la lógica de validación; quedan documentadas aquí para que cualquiera que revise el código entienda por qué está construido así.

1. **¿Qué cuenta como traslape?**
   _[respuesta del equipo — incluir si se consideran horas de montaje/desmontaje y si hay margen]_

2. **¿Inventario por pieza o por cantidad?**
   _[respuesta del equipo]_

3. **¿Qué pasa si dos coordinadores confirman al mismo tiempo dos eventos con el mismo equipo?**
   _[respuesta del equipo]_

4. **¿Qué pasa si el técnico registra el retorno sin señal mientras el coordinador ya reasignó ese equipo?**
   _[respuesta del equipo]_

---

## Roles y credenciales de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| Coordinador | _[correo de prueba]_ | _[contraseña]_ |
| Técnico de campo | _[correo de prueba]_ | _[contraseña]_ |

---

## Tablero y backlog

🔗 **GitHub Projects:** _[enlace al tablero]_

El tablero tiene 4 columnas: Por hacer / En progreso / En revisión / Hecho. El backlog inicial (sección 9 del documento) está cargado ahí con responsable asignado por historia.

---

## Definition of Done

Ver [`DEFINITION_OF_DONE.md`](./DEFINITION_OF_DONE.md).

---

## Fuera de alcance

Este proyecto **no** incluye (ver sección 8 del documento): cotizaciones con precios/facturación, códigos QR/barras, fotografías, calendario tipo Gantt, logística de traslado, firma del cliente, notificaciones, sincronización automática en segundo plano, órdenes de reparación, ni portal para el cliente.
