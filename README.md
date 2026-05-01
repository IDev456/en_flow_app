# En Flow App

Aplicacion web de gestion de tareas basada en flujos secuenciales con `FastAPI + React`, preparada para correr en contenedores.

## Stack

- Backend: FastAPI
- Frontend: React + Vite + TypeScript
- Persistencia: repositorio en memoria, listo para reemplazar por base de datos real

## Estructura

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

## Arranque con Docker

1. Construir y levantar servicios:

```bash
docker compose up --build
```

2. Accesos:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- Docs API: `http://localhost:8000/docs`

El frontend corre con `Vite` dentro del contenedor y el backend con `uvicorn --reload`.

## Flujo funcional implementado

- Crear disparadores con prioridad, tipo, metadata y trazabilidad temporal.
- Iniciar un workflow desde un disparador.
- Generar por defecto un workflow template semilla de 3 pasos:
  - Diagnostico
  - Ejecucion
  - Verificacion final
- Completar pasos de manera secuencial.
- Activar automaticamente el siguiente paso.
- Finalizar el workflow y resolver el disparador al completar el ultimo paso.
- Registrar comentarios e historial de cambios por paso.

## Endpoints principales

- `POST /api/v1/triggers`
- `GET /api/v1/triggers`
- `GET /api/v1/triggers/{id}`
- `POST /api/v1/triggers/{id}/start-workflow`
- `GET /api/v1/workflows`
- `GET /api/v1/workflows/{id}`
- `GET /api/v1/workflows/{id}/steps`
- `POST /api/v1/workflows/{id}/steps`
- `PATCH /api/v1/steps/{id}/status`
- `GET /api/v1/steps/{id}`
- `POST /api/v1/steps/{id}/complete`
- `POST /api/v1/steps/{id}/comments`
- `GET /api/v1/steps/{id}/comments`
- `GET /api/v1/steps/{id}/history`
- `GET /api/v1/dashboard/pending-steps`
- `GET /api/v1/dashboard/active-workflows`

## Pantallas

- Dashboard con workflows activos y pasos abiertos.
- Lista de disparadores con alta rapida.
- Detalle de disparador con arranque de workflow.
- Detalle de workflow con timeline secuencial.
- Detalle de paso con comentarios, historial y cierre operativo.

## Desarrollo local sin contenedores

### Backend

1. Crear entorno virtual.
2. Instalar dependencias:

```bash
pip install -r backend/requirements.txt
```

3. Levantar API:

```bash
uvicorn app.main:app --reload
```

Desde la carpeta `backend`.

### Frontend

1. Instalar dependencias:

```bash
npm install
```

2. Levantar app:

```bash
npm run dev
```

Desde la carpeta `frontend`.

## Variables de entorno

- Backend: copiar `backend/.env.example` a `backend/.env`
- Frontend: copiar `frontend/.env.example` a `frontend/.env`

Con `docker compose`, las variables base ya estan definidas en `docker-compose.yml`.

## Proximos pasos sugeridos

1. Reemplazar el repositorio en memoria por PostgreSQL o SQLite.
2. Agregar autenticacion y permisos por usuario.
3. Incorporar tests automatizados del flujo secuencial.
4. Separar imagenes de desarrollo y produccion.
