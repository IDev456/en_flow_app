# En Flow App

Aplicacion web para gestionar requerimientos mediante **flujos secuenciales de tareas**.

Cada requerimiento nace desde un disparador, inicia un workflow y avanza paso a paso hasta su resolucion final. El foco del proyecto esta en la **trazabilidad**, la **operacion guiada** y la **continuidad del flujo**: cuando un paso se completa, habilita automaticamente el siguiente.

## Stack

- **Backend:** FastAPI
- **Frontend:** React + Vite + TypeScript
- **Ejecucion local:** Docker Compose
- **Persistencia actual:** repositorio en memoria
- **Persistencia objetivo:** base de datos relacional en una siguiente iteracion

## Estado actual

El proyecto ya tiene un flujo funcional de punta a punta:

1. Crear un requerimiento
2. Definir obligatoriamente el primer paso
3. Iniciar un workflow
4. Operar el paso activo
5. Marcar un paso como completado
6. Crear automaticamente el siguiente paso
7. Finalizar el workflow cuando se completa el ultimo paso
8. Resolver el requerimiento al cierre del flujo

Todavia es una version temprana, pero ya tiene estructura de proyecto real, API integrada, frontend navegable y reglas de negocio consistentes.

## Concepto funcional

En Flow modela el trabajo como una secuencia controlada:

- Un **requerimiento** representa una solicitud, problema o evento.
- Ese requerimiento puede disparar un **workflow**.
- Un workflow tiene **pasos ordenados**.
- Solo hay **un paso operativo a la vez**.
- El usuario trabaja sobre ese paso y puede cambiarlo a:
  - `en espera`
  - `problema`
  - `completado`
- Cuando un paso queda en `completado`, el sistema:
  - registra historial
  - conserva comentarios/notas
  - crea el siguiente paso
  - o finaliza el workflow si ya no hay mas pasos

## Funcionalidades implementadas

- Creacion de requerimientos con:
  - `solicitante` opcional
  - `descripcion` opcional
  - `primer paso` obligatorio
- Inicio de workflow desde un requerimiento
- Plantilla semilla de workflow con 3 etapas:
  - `Diagnostico`
  - `Ejecucion`
  - `Verificacion final`
- Generacion secuencial de pasos
- Restriccion para no crear un nuevo paso si el actual sigue abierto
- Cambio de estado de pasos con nota opcional
- Comentarios por paso
- Historial de cambios por paso
- Dashboard operativo
- Lista principal de requerimientos con KPIs, filtros y cantidad de pasos creados
- Vista de workflow con navegacion entre pasos y panel lateral de detalle
- Creacion de requerimiento mediante modal, sin salir de la pantalla principal

## Arquitectura

### Backend

El backend sigue una estructura por capas:

- `schemas`: contratos Pydantic y tipos del dominio
- `repositories`: abstraccion de persistencia e implementacion en memoria
- `services`: reglas de negocio y orquestacion del workflow
- `api`: endpoints FastAPI
- `core`: configuracion y errores compartidos

Esto deja el proyecto listo para migrar a PostgreSQL mas adelante sin reescribir la API ni la logica principal.

### Frontend

El frontend esta organizado por feature:

- `dashboard`
- `triggers`
- `workflows`
- `steps`

Las llamadas HTTP estan centralizadas y la UI se compone desde componentes reutilizables para badges, timeline, panel de paso, historial y modal de creacion.

## Estructura del repositorio

```text
.
|-- backend
|   |-- app
|   |   |-- api
|   |   |-- core
|   |   |-- db
|   |   |-- repositories
|   |   |-- schemas
|   |   `-- services
|   |-- .dockerignore
|   |-- .env.example
|   |-- Dockerfile
|   `-- requirements.txt
|-- docker-compose.yml
|-- frontend
|   |-- .dockerignore
|   |-- public
|   |-- Dockerfile
|   `-- src
|       |-- api
|       |-- components
|       `-- features
`-- README.md
```

## Puesta en marcha

### Opcion recomendada: Docker

```bash
docker compose up --build
```

Servicios disponibles:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- Swagger UI: `http://localhost:8000/docs`

Notas:

- el backend corre con `uvicorn --reload`
- el frontend corre con `vite`
- la configuracion actual esta orientada a desarrollo local

## Desarrollo local sin Docker

### Backend

Desde `backend/`:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

Desde `frontend/`:

```bash
npm install
npm run dev
```

## Variables de entorno

Hay ejemplos base en:

- `backend/.env.example`
- `frontend/.env.example`

Cuando se usa Docker Compose, las variables principales ya estan definidas en `docker-compose.yml`.

## Modelo de dominio

Entidades principales implementadas:

- `Trigger`
- `WorkflowInstance`
- `WorkflowTemplate`
- `StepTemplate`
- `StepInstance`
- `Comment`
- `StepHistory`

Estados visibles hoy:

- Requerimiento: `sin flujo`, `en proceso`, `finalizado`, `cancelado`
- Workflow: `en proceso`, `finalizado`, `cancelado`
- Paso: `en proceso`, `en espera`, `problema`, `completado`

Nota:

- internamente todavia existen algunos estados tecnicos para compatibilidad entre capas, pero la UI ya esta unificada con este vocabulario.

## Reglas de negocio principales

- Todo workflow debe arrancar con un primer paso definido.
- Solo puede existir un paso operativo a la vez.
- No se puede completar un paso que no este abierto para operar.
- No se puede crear manualmente un paso nuevo si el actual no fue resuelto.
- `completado` dispara la creacion del siguiente paso.
- Si no existe un siguiente paso, el workflow pasa a `finalizado`.
- Cuando el workflow finaliza, el requerimiento pasa a `resuelto`.

## API disponible

### Triggers

- `POST /api/v1/triggers`
- `GET /api/v1/triggers`
- `GET /api/v1/triggers/{id}`
- `POST /api/v1/triggers/{id}/start-workflow`

### Workflows

- `GET /api/v1/workflows`
- `GET /api/v1/workflows/{id}`
- `GET /api/v1/workflows/{id}/steps`
- `POST /api/v1/workflows/{id}/steps`

### Steps

- `GET /api/v1/steps/{id}`
- `PATCH /api/v1/steps/{id}/status`
- `POST /api/v1/steps/{id}/complete`
- `POST /api/v1/steps/{id}/comments`
- `GET /api/v1/steps/{id}/comments`
- `GET /api/v1/steps/{id}/history`

### Dashboard

- `GET /api/v1/dashboard/pending-steps`
- `GET /api/v1/dashboard/active-workflows`

### Utilidad

- `GET /api/v1/health`

## Pantallas incluidas

- Dashboard
- Lista principal de requerimientos
- Modal de nuevo requerimiento
- Detalle de requerimiento
- Detalle de workflow
- Detalle de paso con:
  - bitacora
  - propiedades
  - historial
  - cambio de estado

## Ejemplo de uso

Caso minimo soportado actualmente:

1. Crear un requerimiento
2. Definir la descripcion del primer paso
3. Iniciar el workflow
4. Ver el paso inicial en proceso
5. Marcarlo como completado
6. Ver creado automaticamente el segundo paso
7. Completar los pasos siguientes
8. Ver el workflow finalizado
9. Ver el requerimiento resuelto

## Limitaciones actuales

- La persistencia sigue siendo en memoria
- Los datos se reinician al reiniciar el backend
- No hay autenticacion ni permisos
- No hay migraciones de base de datos
- No hay pipeline de CI/CD
- La cobertura automatizada de tests todavia es baja

## Roadmap

- Migrar persistencia a PostgreSQL
- Agregar autenticacion y roles
- Incorporar tests de reglas de negocio
- Mejorar observabilidad y auditoria operativa
- Preparar imagenes y configuracion para despliegue productivo

## Contribucion

Hoy las mejoras de mayor impacto serian:

- persistencia real
- tests backend/frontend
- endurecimiento de reglas del workflow
- refinamiento de UX operativa
- consistencia de contratos API

## Licencia

Todavia no se definio una licencia para este repositorio.
