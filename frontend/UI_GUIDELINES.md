# UI Guidelines

## Objetivo
Evolucionar la interfaz hacia un criterio inspirado en Material Design 3 sin cambiar la estructura operativa de la app. La prioridad sigue siendo claridad de estados, trazabilidad y continuidad de trabajo.

## Lo que tomamos de M3
- Tokens visuales para superficies, bordes, estados y motion.
- Jerarquia mas clara entre contenedores, cards, chips y acciones.
- Radios moderados y consistentes.
- Elevaciones sobrias para diferenciar surface, raised y overlay.
- Motion corto y util para continuidad visual.
- Tipografia ordenada para dashboard operativo.

## Lo que no tomamos de M3
- Dynamic color o personalizacion de paleta por usuario.
- Patrones mobile-first como bottom navigation o FAB global.
- Bordes excesivamente redondeados.
- Animaciones expresivas, rebotes o loops decorativos.
- Densidad baja tipo app consumer.
- Reestructuracion de layouts o navegacion.

## Tokens visuales
- `palette.surfaceContainerLowest` a `surfaceContainerHighest`: capas de superficie.
- `palette.outline` y `outlineVariant`: bordes y divisores.
- `palette.onSurfaceVariant`: texto secundario de alta legibilidad.
- `palette.status.*`: estados operativos semanticos.

## Estados operativos
- `active`: azul operativo. Debe verse rapido sin competir con alertas.
- `waiting`: ambar. Prioridad alta, pero sin parecer error.
- `finalized`: verde estable y sobrio.
- `problem`: rojo nitido. Nunca suavizar demasiado.
- `cancelled`: gris secundario. Existe, pero no protagoniza.
- `neutral`: gris funcional para estados informativos o sin flujo.

## Motion
- Microinteracciones: 120 a 160 ms.
- Entrada y salida de elementos: 180 a 240 ms.
- Cambios de layout: 260 a 300 ms.
- Usar motion para continuidad, no como decoracion.
- Evitar loops permanentes y pulsos agresivos.

## Reduced Motion
- Respetar `prefers-reduced-motion`.
- Desactivar desplazamientos, escalas y animaciones decorativas.
- Reducir a minimo cambios animados de opacidad y transform.
- Mantener feedback visual por color, contraste y jerarquia, no por movimiento.

## Densidad
- La app es un dashboard operativo, no una landing ni una app mobile-first.
- Mantener tablas legibles sin inflar alturas.
- Priorizar informacion visible y acciones cercanas al contexto.
- Evitar exceso de espacios vacios entre controles.

## Reglas de componentes
- Cards: usar superficies claras, borde sutil y elevacion sobria.
- Chips: usar tokens semanticos y radios pill.
- Botones: CTA primario claro, acciones secundarias neutrales, destructivas aisladas.
- DataGrid: headers compactos, hover suave, selected legible, footer integrado.
- Dialogs: overlay con jerarquia clara y transicion corta.

## Pantallas de flows
- Filtros principales: `Activos`, `Esperando`, `Finalizados`, `Todos`.
- `Cancelados` no debe competir como filtro principal.
- Los estados criticos deben leerse primero desde color, luego desde texto.
- Recordatorios, registros y acciones rapidas deben compartir un lenguaje visual consistente.
