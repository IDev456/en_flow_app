# AI_WORKFLOW.md

## Reglas Generales para Trabajo Asistido por IA

### Principio Fundamental
**Primero analizar, luego modificar.** Nunca modificar código sin entender completamente el contexto, impacto y alcance.

### Alcance de Cambios
- **No hacer refactors generales** si no se piden explícitamente
- **No modificar archivos fuera del alcance** de la tarea solicitada
- **No cambiar nombres** de rutas, modelos, entidades, props o schemas sin justificación clara
- **Mantener compatibilidad** entre frontend y backend en todo momento

### Análisis Previo Obligatorio
Antes de cualquier cambio:
1. **Revisar archivos relacionados** (frontend + backend para features completas)
2. **Entender flujo de datos** y dependencias
3. **Verificar impacto en estados** y lógica de negocio
4. **Revisar convenciones del proyecto** (nombres, estructura, patrones)

### Zonas de Alto Riesgo
**Requieren revisión manual antes de modificar:**
- Lógica de estados (workflow.status, step.status, trigger.status)
- Flujos y transiciones (StepTransitionType, completeStep, resolveExternalResponse)
- Secuenciador (WorkflowGraph.tsx, lógica de pasos activos)
- Tareas y requerimientos (repositorios, servicios, schemas)
- Relaciones entre entidades (foreign keys, dependencias)

### Estrategia de Cambios
- **Aplicar siempre el cambio mínimo necesario**
- **Dividir tareas grandes** en cambios pequeños e independientes
- **Probar cada cambio** antes de continuar
- **Mantener compatibilidad** hacia atrás cuando sea posible

### Protocolo Post-Cambio
Al finalizar cualquier modificación:
1. **Listar archivos modificados**
2. **Describir cambios realizados** con detalle
3. **Identificar puntos a probar** (funcionalidades afectadas)
4. **Advertir sobre riesgos** o efectos secundarios
5. **Confirmar build exitoso** si aplica

### Punto de Detención
**Si hay dudas sobre:**
- Impacto en lógica de negocio
- Compatibilidad frontend-backend
- Estados o transiciones
- Arquitectura existente

**Detenerse inmediatamente y pedir confirmación al usuario.**

### Validaciones Obligatorias
Después de modificar:
- **Build exitoso** (tsc + vite)
- **Tipos TypeScript** correctos
- **Imports** funcionando
- **Lógica de estados** preservada
- **Interfaz de usuario** funcional

### Comunicación Clara
- **Usar lenguaje preciso** al describir cambios
- **Incluir contexto** de por qué se hizo cada cambio
- **Advertir sobre limitaciones** del análisis IA
- **Pedir feedback** sobre resultados

## Metodología de Trabajo con IAs

Cuando una IA reciba una tarea, debe comenzar con:

"Antes de modificar archivos, lee PROJECT_CONTEXT.md, AI_WORKFLOW.md y LOCAL_MODEL_INSTRUCTIONS.md. Usa esas reglas como contexto obligatorio."

Esta metodología se estructura así:
1. ChatGPT analiza el proyecto, el cambio requerido y los riesgos.
2. ChatGPT genera prompts concretos y acotados para que una IA local o externa ejecute tareas puntuales.
3. La IA ejecutora debe leer primero los archivos de contexto.
4. La IA ejecutora no debe hacer refactors generales.
5. La IA ejecutora debe aplicar el cambio mínimo necesario.
6. La IA ejecutora debe separar análisis de modificación.
7. Al finalizar, debe resumir:
   - archivos modificados
   - cambios realizados
   - comandos ejecutados
   - resultado del build/test
   - puntos a probar manualmente

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
<parameter name="filePath">c:\Users\Ivan Mendez\Documents\en_flow_app\AI_WORKFLOW.md