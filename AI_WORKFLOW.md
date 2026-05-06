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
- **Pedir feedback** sobre resultados</content>
<parameter name="filePath">c:\Users\Ivan Mendez\Documents\en_flow_app\AI_WORKFLOW.md