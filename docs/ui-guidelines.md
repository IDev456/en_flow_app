# En Flow App UI Guidelines

## Concepto visual
- En Flow App se diseña como **bandeja personal de continuidad operativa**.
- La pregunta central de cada vista es: **“¿con qué sigo ahora?”**.
- La UI prioriza lectura rápida y acción clara por contexto.

## Modos de tema
- `dark`: continuidad del estilo actual, contraste alto y fondos profundos.
- `warmLight`: modo claro cálido, con crema suave y cards blanco cálido.
- Selector en AppBar con persistencia en `localStorage` (`enflow_theme_mode`).

## Estados y color
- `en_proceso / activa`: tono informativo.
- `esperando_respuesta`: tono informativo suave, no de error.
- `en_espera`: tono warning suave.
- `con_problema`: tono error moderado.
- `finalizado / resuelto`: tono success suave.

## Jerarquía operativa
- **Bandeja**: centro operativo.
- **Flows**: continuidad de trabajo.
- **Requerimientos**: agrupador secundario.

## Acciones principales
- Global: **Capturar tarea**.
- Tarea activa: **Completar tarea**.
- En espera externa: **Registrar respuesta recibida**.
- Siempre una acción dominante por contexto; el resto secundarias.

## Criterio de cards
- Cada card debe mostrar:
  - título
  - estado
  - qué está pendiente / tarea actual
  - último registro o señal temporal
  - acceso claro al detalle
- Evitar sobrecarga de botones y métricas.
