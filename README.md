# En Flow App

Aplicación web para gestionar requerimientos mediante **flujos secuenciales de tareas**.

Cada requerimiento nace desde un disparador, inicia un workflow y avanza paso a paso hasta su resolución final. El foco del proyecto está en la **trazabilidad**, la **operación guiada** y la **continuidad del flujo**: cuando un paso se completa, habilita automáticamente el siguiente.

## 🚀 Características principales

- **Gestión de requerimientos**: Creación y seguimiento de solicitudes con workflow automatizado
- **Flujos secuenciales**: Pasos ordenados con estados controlados (activo, espera, problema, completado)
- **Interfaz intuitiva**: Dashboard operativo con navegación fluida entre requerimientos y workflows
- **Trazabilidad completa**: Historial de cambios, comentarios y timeline por paso
- **Operación guiada**: Solo un paso operativo a la vez, con restricciones automáticas
- **Persistencia robusta**: PostgreSQL con migraciones automáticas
- **Arquitectura escalable**: Backend FastAPI + Frontend React/TypeScript

## 🛠️ Stack Tecnológico

- **Backend:** FastAPI (Python)
- **Frontend:** React + Vite + TypeScript + Material-UI
- **Base de datos:** PostgreSQL
- **Contenedorización:** Docker & Docker Compose
- **ORM:** SQLAlchemy
- **Validación:** Pydantic

## 📊 Estado actual

El proyecto cuenta con un flujo funcional completo de punta a punta:

### ✅ Funcionalidades implementadas

- **Gestión de requerimientos**
  - Creación con solicitante y descripción opcionales
  - Primer paso obligatorio para iniciar workflow
  - Estados: sin flujo, en proceso, finalizado, cancelado

- **Workflows operativos**
  - Plantilla semilla con 3 etapas (Diagnóstico, Ejecución, Verificación)
  - Generación secuencial automática de pasos
  - Restricción de creación de nuevos pasos hasta completar el actual

- **Operación de pasos**
  - Estados: activo, espera, problema, completado
  - Comentarios y notas por paso
  - Historial completo de cambios
  - Timeline visual con indicadores de estado

- **Interfaz de usuario**
  - Dashboard con KPIs y filtros
  - Lista principal de requerimientos
  - Vista detallada de workflow con secuenciador visual
  - Panel lateral de detalle de pasos
  - Modal de creación sin salir de contexto
  - Navegación breadcrumbs consistente

### 🎯 Mejoras recientes

- **Secuenciador optimizado**: Eliminación de elementos redundantes (bloque de cierre, chips duplicados)
- **Interacción precisa**: Botón "Listo" aislado para completar tareas, área de registro exclusiva para abrir panel lateral
- **UX mejorada**: Flujo más limpio y directo en la gestión de workflows

## 🏗️ Arquitectura

### Backend (FastAPI)

Estructura por capas desacopladas:

```
backend/app/
├── api/           # Endpoints REST
├── core/          # Configuración y utilidades compartidas
├── db/            # Conexión y modelos de base de datos
├── repositories/  # Abstracción de persistencia
├── schemas/       # Contratos Pydantic y tipos de dominio
└── services/      # Reglas de negocio y orquestación
```

### Frontend (React/TypeScript)

Organización por features:

```
frontend/src/
├── api/           # Cliente HTTP centralizado
├── components/    # Componentes reutilizables
└── features/      # Módulos funcionales
    ├── dashboard/
    ├── flow/
    ├── tasks/
    └── triggers/
```

## 📁 Estructura del repositorio

```
.
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── db/
│   │   ├── repositories/
│   │   ├── schemas/
│   │   └── services/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   └── features/
│   ├── Dockerfile
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
└── README.md
```

## 🚀 Puesta en marcha

### Opción recomendada: Docker Compose

```bash
# Clonar el repositorio
git clone <repository-url>
cd en_flow_app

# Construir e iniciar servicios
docker compose up --build
```

**Servicios disponibles:**
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **Documentación API:** http://localhost:8000/docs
- **Base de datos:** localhost:5432

### Desarrollo local sin Docker

#### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Variables de entorno mínimas:
```bash
DATABASE_URL=postgresql+psycopg://enflow:enflow@localhost:5432/enflow
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

## ⚙️ Variables de entorno

Ejemplos base disponibles en:
- `backend/.env.example`
- `frontend/.env.example`

Con Docker Compose, las variables principales están predefinidas en `docker-compose.yml`.

## 📋 Modelo de dominio

### Entidades principales

- **Trigger**: Disparador de requerimiento
- **WorkflowInstance**: Instancia ejecutándose de un workflow
- **WorkflowTemplate**: Plantilla de workflow
- **StepTemplate**: Plantilla de paso
- **StepInstance**: Paso en ejecución
- **Comment**: Comentarios por paso
- **StepHistory**: Historial de cambios

### Estados del sistema

**Requerimientos:**
- `sin flujo` - Pendiente de iniciar workflow
- `en proceso` - Workflow activo
- `finalizado` - Resuelto exitosamente
- `cancelado` - Cancelado por usuario

**Workflows:**
- `en proceso` - Pasos en ejecución
- `finalizado` - Todos los pasos completados
- `cancelado` - Workflow cancelado

**Pasos:**
- `activo` - En ejecución actual
- `espera` - Pausado temporalmente
- `problema` - Requiere atención especial
- `completado` - Finalizado exitosamente

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -am 'Agrega nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

---

**Nota:** Este es un proyecto en desarrollo activo. La documentación y funcionalidades pueden evolucionar con el tiempo.

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

- No hay autenticacion ni permisos
- No hay migraciones de base de datos
- No hay pipeline de CI/CD
- La cobertura automatizada de tests todavia es baja

## Roadmap

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
