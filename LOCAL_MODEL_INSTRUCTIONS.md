# LOCAL_MODEL_INSTRUCTIONS.md

## Instrucciones para Modelos Locales (ej: qwen2.5-coder:7b en Cline)

### Trabajo con Contexto Limitado
- **Leer archivos completos** antes de asumir estructura
- **No asumir** funcionalidades que no estén en el código visible
- **Preguntar** si el contexto es insuficiente
- **Usar herramientas** para explorar (grep, read_file, semantic_search)
- **Documentar** hallazgos para futuras sesiones

### División de Tareas Grandes
- **Descomponer** en subtareas de 1-2 archivos
- **Validar** cada subtarea antes de continuar
- **Mantener** consistencia entre cambios
- **Revertir** si algo falla en validación

### Cambios Seguros
**Puede ejecutar sin revisión adicional:**
- Cambios visuales minimalistas (colores, espaciado, texto)
- Agregar logs o console.log
- Corregir typos en strings
- Agregar comentarios
- Reordenar imports (siguiendo convenciones)
- Cambios en archivos de configuración no críticos

### Cambios que Requieren Revisión Previa
**NO ejecutar sin confirmación:**
- Modificar lógica de estados o transiciones
- Cambiar schemas o tipos
- Agregar nuevos endpoints
- Modificar modelos de BD
- Cambiar rutas o navegación
- Alterar lógica del secuenciador
- Modificar dependencias

### Reglas para React/TypeScript
- **Usar tipos existentes** de types.ts
- **No cambiar** nombres de props o estados
- **Mantener** estructura de componentes
- **Preservar** lógica de efectos y estado
- **Usar** Material-UI según patrones existentes
- **Evitar** crear nuevos componentes sin necesidad

### Reglas para FastAPI/Python
- **Usar schemas** de Pydantic existentes
- **No cambiar** firmas de funciones
- **Mantener** estructura de respuestas
- **Preservar** lógica de servicios
- **Usar** repositorios para BD
- **Validar** con tipos existentes

### Reglas para Base de Datos
- **No modificar** modelos SQLAlchemy sin revisión
- **Entender** relaciones antes de cambiar
- **Preservar** constraints y foreign keys
- **Revisar** migraciones si aplica

### Cambios Visuales Minimalistas
- **Limitarse** a ajustes de UI/UX puntuales
- **No rediseñar** componentes completos
- **Mantener** consistencia visual
- **Probar** en diferentes tamaños si aplica
- **Documentar** cambios visuales claramente

### Arquitectura y Entidades
- **NO inventar** nueva arquitectura
- **NO crear** entidades que no existan
- **NO asumir** datos no presentes en código
- **Seguir** patrones existentes estrictamente
- **Preguntar** sobre extensiones o nuevas features

### Manejo de Errores
- **Reportar** inmediatamente si algo no compila
- **Detener** ejecución si hay errores inesperados
- **Pedir** ayuda para debugging complejo
- **Documentar** problemas encontrados

### Comunicación Eficiente
- **Ser conciso** pero completo en respuestas
- **Usar** formato claro (listas, código blocks)
- **Confirmar** comprensión antes de proceder
- **Preguntar** si instrucciones no están claras

### Limitaciones del Modelo Local
- **Contexto limitado**: Recordar que no tengo acceso completo al proyecto
- **Análisis estático**: Solo veo código, no runtime
- **Sin ejecución**: No puedo probar cambios automáticamente
- **Dependiente de herramientas**: Necesito usar grep/read_file para explorar

### Protocolo de Seguridad
- **Nunca** ejecutar comandos peligrosos
- **Nunca** modificar archivos críticos sin backup conceptual
- **Siempre** validar cambios con build
- **Detener** si hay incertidumbre sobre impacto</content>
<parameter name="filePath">c:\Users\Ivan Mendez\Documents\en_flow_app\LOCAL_MODEL_INSTRUCTIONS.md