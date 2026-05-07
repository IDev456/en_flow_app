# PROJECT_CONTEXT.md

## Descripción de la Aplicación

En Flow App es una aplicación web para gestionar requerimientos mediante **flujos secuenciales de tareas**. Cada requerimiento nace desde un disparador (trigger), inicia un workflow y avanza paso a paso hasta su resolución final. El foco está en la **trazabilidad**, la **operación guiada** y la **continuidad del flujo**: cuando un paso se completa, habilita automáticamente el siguiente.

## Stack Tecnológico

- **Backend:** FastAPI (Python) con uvicorn
- **Frontend:** React + Vite + TypeScript + Material-UI (MUI)
- **Base de datos:** PostgreSQL
- **ORM:** SQLAlchemy
- **Validación:** Pydantic
- **Contenedorización:** Docker & Docker Compose
- **Desarrollo:** Hot reload en frontend (Vite), reload en backend (uvicorn)

## Estructura General de Carpetas

```
.
├── backend/
│   ├── app/
│   │   ├── api/           # Endpoints REST (v1/)
│   │   ├── core/          # Configuración y utilidades compartidas
│   │   ├── db/            # Conexión y modelos de base de datos
│   │   ├── repositories/  # Abstracción de persistencia
│   │   ├── schemas/       # Contratos Pydantic y tipos de dominio
│   │   └── services/      # Reglas de negocio y orquestación
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── api/           # Cliente HTTP centralizado
│   │   ├── components/    # Componentes reutilizables
│   │   └── features/      # Módulos funcionales (dashboard, flow, tasks, triggers)
│   ├── Dockerfile
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
└── README.md
```

## Conceptos Principales del Dominio

### Entidades Principales

1. **Trigger/Requerimiento**: Origen de la solicitud
   - Estados: sin_flows, en_proceso, esperando_respuesta, con_problema, resuelto, cancelado
   - Atributos: solicitante, descripcion, tipo, metadata

2. **Workflow**: Flujo secuencial de tareas
   - Estados: pendiente, en_proceso, esperando_respuesta, en_espera, con_problema, finalizado, cancelado
   - Contiene pasos ordenados

3. **Step/Tarea**: Unidad operativa individual
   - Estados: activo, espera, problema, esperando_respuesta, completado, cancelada
   - Transiciones: next_task, wait_external, finish_flow

4. **WorkflowTemplate**: Plantilla para generar workflows (ej: Diagnóstico, Ejecución, Verificación)

### Estados y Transiciones

- **Trigger**: Puede tener múltiples workflows asociados
- **Workflow**: Tiene un paso activo a la vez (restricción operativa)
- **Step**: Solo un paso puede estar "activo" en un workflow
- **Transiciones**: Al completar un paso, se puede crear siguiente tarea, esperar respuesta externa, o finalizar flow

## Flujo General Esperado

1. **Creación de Trigger**: Usuario crea requerimiento con descripción
2. **Inicio de Workflow**: Sistema genera workflow basado en template
3. **Operación Guiada**: Solo un paso activo a la vez
4. **Completar Paso**: Usuario marca "Listo", elige transición (siguiente tarea, esperar externa, finalizar)
5. **Continuidad**: Sistema habilita siguiente paso automáticamente
6. **Resolución**: Workflow llega a estado finalizado

## Relación Frontend-Backend

- **Frontend**: React con hooks, componentes por feature, cliente HTTP centralizado
- **Backend**: FastAPI con endpoints REST, separación clara de capas (api, services, repositories)
- **Comunicación**: JSON sobre HTTP, frontend consume /api/v1/*
- **Estado**: Frontend maneja estado local, backend persiste en PostgreSQL
- **Sincronización**: Frontend refresca datos después de mutaciones

## Convenciones Importantes

### Backend
- **Schemas**: Pydantic para validación y serialización
- **Repositories**: Abstracción de BD, métodos CRUD
- **Services**: Lógica de negocio, orquestación
- **Enums**: Usar StrEnum para tipos string
- **Nombres**: Español para entidades de dominio (workflow, trigger, step)

### Frontend
- **Types**: Union types en lugar de enums (ej: StepTransitionType = "next_task" | "wait_external" | "finish_flow")
- **Componentes**: Organizados por features
- **API**: Cliente centralizado en src/api/client.ts
- **Estado**: useState/useEffect para manejo local
- **UI**: Material-UI con tema consistente

### Base de Datos
- **Tablas**: triggers, workflows, steps, workflow_templates, etc.
- **Relaciones**: Foreign keys entre entidades
- **Migraciones**: SQLAlchemy maneja schema

## Comandos Útiles para Desarrollo

### Docker Compose (Recomendado)
```bash
# Construir e iniciar todos los servicios
docker compose up --build

# Solo backend y BD
docker compose up backend db

# Solo frontend
docker compose up frontend

# Ver logs
docker compose logs -f [service]

# Ejecutar comandos en contenedor
docker compose exec backend bash
```

### Desarrollo Local
```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev

# Build frontend
npm run build
```

### Base de Datos
- **Host**: localhost:5432 (desde host), db:5432 (desde contenedores)
- **DB**: enflow
- **User/Pass**: enflow/enflow

## Riesgos Conocidos o Zonas Sensibles

- **Estados de Workflow/Steps**: Cambios en lógica de estados pueden romper la operación guiada
- **Transiciones**: Lógica de next_task/wait_external/finish_flow debe mantener consistencia
- **Paso Activo**: Solo un paso activo por workflow - violaciones pueden causar confusión operativa
- **Frontend-Backend Sync**: Cambios en schemas deben reflejarse en ambos lados
- **Secuenciador**: Componente WorkflowGraph maneja lógica compleja de estados y transiciones
- **Panel Lateral**: Independiente del modal "Completar tarea" - no mezclar interacciones
- **Docker Volumes**: Cambios en BD pueden requerir recrear volúmenes

## Notas Adicionales

- **Idioma**: Código en español para conceptos de dominio, inglés para stack técnico
- **Testing**: No confirmado en código actual (no hay archivos de test visibles)
- **CI/CD**: No confirmado en código actual
- **Documentación API**: Disponible en /docs cuando backend está corriendo

## Entorno y Rutas

Este proyecto puede trabajarse desde distintos entornos: Windows, Linux, WSL, contenedores o herramientas de IA integradas al IDE.

No asumir rutas absolutas del proyecto.

La IA ejecutora debe:
1. Trabajar desde la raíz del repositorio actualmente abierto.
2. Confirmar la ubicación antes de ejecutar comandos.
3. Usar rutas relativas al repositorio.
4. Adaptar los comandos al shell disponible.
5. No mezclar sintaxis de shells distintos.

Para comandos:
- Si el entorno es PowerShell, usar `;` como separador.
- Si el entorno es Bash/Linux/WSL, puede usarse `&&`.
- No usar comandos Linux si el entorno activo es PowerShell.
- No usar comandos PowerShell si el entorno activo es Bash/Linux.
- Si un comando falla por sintaxis del shell, no insistir con variantes al azar: identificar el shell activo y adaptar el comando correctamente.

La raíz del repo puede identificarse por la presencia de archivos/carpetas como:
- .git
- docker-compose.yml
- frontend/
- backend/
- package.json, si aplica
- README.md, si aplica</content>
<parameter name="filePath">c:\Users\Ivan Mendez\Documents\en_flow_app\PROJECT_CONTEXT.md