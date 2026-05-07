# PROMPT_TEMPLATES.md

## Plantillas Reutilizables de Prompts para Cline

### Analizar una Funcionalidad sin Modificar

```
Analiza la funcionalidad [NOMBRE_FUNCIONALIDAD] en el proyecto En Flow App.

Revisa estos archivos:
- frontend/src/features/[feature]/[componente].tsx
- backend/app/[capa]/[archivo].py
- [otros archivos relevantes]

Describe:
1. Qué hace exactamente
2. Flujo de datos (frontend → backend → BD)
3. Estados involucrados
4. Dependencias y efectos secundarios
5. Puntos de extensión o mejora

NO modifiques código, solo analiza y documenta.
```

### Aplicar un Cambio Visual Puntual

```
Aplica este cambio visual mínimo en [COMPONENTE]:

[CAMBIOS_ESPECÍFICOS]

Ejemplo: "Cambiar el texto del botón de 'Guardar' a 'Confirmar'"

Requisitos:
- Solo modificar estilos o texto
- No cambiar lógica
- Mantener funcionalidad existente
- Verificar que compile

Después de aplicar, confirma que el cambio es visible y no rompe nada.
```

### Corregir un Bug Puntual

```
Corrige este bug específico en [ARCHIVO/COMPONENTE]:

DESCRIPCIÓN DEL BUG:
[Descripción clara del problema]

ARCHIVOS INVOLUCRADOS:
- [lista de archivos]

SOLUCIÓN ESPERADA:
[Qué debe hacer después del fix]

Pasos:
1. Identificar causa raíz
2. Aplicar fix mínimo
3. Verificar que compile
4. Confirmar que el bug está resuelto
```

### Agregar un Endpoint CRUD Simple

```
Agrega un endpoint CRUD simple para [ENTIDAD] en el backend.

Especificaciones:
- Ruta: /api/v1/[entidad]
- Métodos: GET (listar), POST (crear), GET /{id} (obtener), PUT /{id} (actualizar), DELETE /{id} (eliminar)
- Schema: Basado en [schema existente similar]
- Repository: Crear métodos en [repository].py
- Service: Lógica básica en [service].py

NO modifiques frontend aún.
Primero implementa backend completo y verifica que funcione.
```

### Revisar Compatibilidad Frontend-Backend

```
Revisa la compatibilidad entre frontend y backend para [FUNCIONALIDAD].

Archivos a revisar:
- Frontend: [componentes y tipos]
- Backend: [endpoints y schemas]

Verifica:
1. Tipos coinciden entre types.ts y schemas Python
2. Payloads de requests/responses son compatibles
3. Manejo de errores consistente
4. Estados sincronizados

Lista cualquier inconsistencia encontrada.
```

### Eliminar una Opción de UI sin Romper Lógica

```
Elimina la opción [OPCIÓN] de la interfaz en [COMPONENTE].

Contexto:
- Archivo: [ruta completa]
- Opción a eliminar: [descripción]
- Lógica afectada: [si aplica]

Pasos:
1. Identificar dónde se renderiza
2. Remover elementos de UI
3. Limpiar código relacionado (handlers, estado)
4. Verificar que compile
5. Confirmar que funcionalidad restante funciona
```

### Revisar el Secuenciador

```
Revisa el componente WorkflowGraph (secuenciador) para [PROBLEMA_ESPECÍFICO].

Archivos clave:
- frontend/src/features/flow/components/WorkflowGraph.tsx
- frontend/src/features/flow/components/CompleteStepDialog.tsx
- frontend/src/features/flow/pages/WorkflowDetailPage.tsx

Analiza:
1. Lógica de estados de pasos
2. Interacciones de botones
3. Transiciones entre pasos
4. Sincronización con backend

Identifica cualquier problema o mejora posible.
```

### Revisar Tareas, Flows y Requerimientos

```
Revisa la gestión de [TAREAS/FLOWS/REQUERIMIENTOS] para identificar [PROBLEMA].

Archivos relevantes:
- Backend: schemas/, services/, repositories/
- Frontend: types.ts, componentes relacionados
- BD: modelos y relaciones

Enfócate en:
1. Estados y transiciones
2. Validaciones
3. Relaciones entre entidades
4. Lógica de negocio

Documenta hallazgos y recomendaciones.
```

### Ejecutar Validaciones Después de Modificar

```
Ejecuta validaciones completas después de modificar [ARCHIVOS/COMPONENTES].

Pasos obligatorios:
1. Build frontend: Ejecutar build desde la raíz del repositorio (adaptar comando al shell activo)
2. Verificar TypeScript: Sin errores de compilación
3. Verificar imports: Todos resueltos
4. Probar funcionalidad: [funciones específicas a probar]
5. Verificar UI: [elementos visuales a revisar]

Reporta cualquier error encontrado.
```

### Preparar Resumen del Diff

```
Prepara un resumen completo de los cambios realizados.

Estructura del resumen:
1. **Archivos modificados**: Lista completa con rutas
2. **Cambios realizados**: Descripción detallada por archivo
3. **Lógica afectada**: Qué funcionalidades cambiaron
4. **Puntos a probar**: Lista de validaciones necesarias
5. **Riesgos identificados**: Efectos secundarios posibles
6. **Compatibilidad**: Confirmación frontend/backend

Incluye código relevante si es necesario para explicación.
```

## Reglas para Prompts Operativos

Los prompts generados para IAs ejecutoras no deben incluir rutas absolutas salvo que el usuario lo pida explícitamente para un entorno concreto.

En su lugar, deben decir:
- "Desde la raíz del repositorio"
- "Usar rutas relativas"
- "Adaptar comandos al shell activo"

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
<parameter name="filePath">c:\Users\Ivan Mendez\Documents\en_flow_app\PROMPT_TEMPLATES.md