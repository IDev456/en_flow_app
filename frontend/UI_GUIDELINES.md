# UI Guidelines

## Objetivo
Evolucionar la interfaz hacia un criterio inspirado en Material Design 3 sin cambiar la estructura operativa de la app. La prioridad sigue siendo claridad de estados, trazabilidad y continuidad de trabajo.

## Lo que tomamos de M3
- Tokens visuales para superficies, bordes, estados y motion.
- Jerarquía más clara entre contenedores, cards, chips y acciones.
- Radios moderados y consistentes.
- Elevaciones sobrias para diferenciar surface, raised y overlay.
- Motion corto y útil para continuidad visual.
- Tipografía ordenada para dashboard operativo.

## Lo que no tomamos de M3
- Dynamic color o personalización de paleta por usuario.
- Patrones mobile-first como bottom navigation o FAB global.
- Bordes excesivamente redondeados.
- Animaciones expresivas, rebotes o loops decorativos.
- Densidad baja tipo app consumer.
- Reestructuración de layouts o navegación.

## Tokens visuales
- `palette.surfaceContainerLowest` a `surfaceContainerHighest`: capas de superficie.
- `palette.outline` y `outlineVariant`: bordes y divisores.
- `palette.onSurfaceVariant`: texto secundario de alta legibilidad.
- `palette.status.*`: estados operativos semánticos.

## Estados operativos
- `active`: azul operativo. Debe verse rápido sin competir con alertas.
- `waiting`: ámbar. Prioridad alta, pero sin parecer error.
- `finalized`: verde estable y sobrio.
- `problem`: rojo nítido. Nunca suavizar demasiado.
- `cancelled`: gris secundario. Existe, pero no protagoniza.
- `neutral`: gris funcional para estados informativos o sin flujo.

## Motion
- Microinteracciones: 120 a 160 ms.
- Entrada y salida de elementos: 180 a 240 ms.
- Cambios de layout: 260 a 300 ms.
- Usar motion para continuidad, no como decoración.
- El motion debe percibirse, pero seguir siendo funcional.
- Evitar loops permanentes y pulsos agresivos.

## Reduced Motion
- Respetar `prefers-reduced-motion`.
- Desactivar desplazamientos, escalas y animaciones decorativas.
- Reducir al mínimo cambios animados de opacidad y transform.
- Mantener feedback visual por color, contraste y jerarquía, no por movimiento.

## Densidad
- La app es un dashboard operativo, no una landing ni una app mobile-first.
- Mantener tablas legibles sin inflar alturas.
- Priorizar información visible y acciones cercanas al contexto.
- Evitar exceso de espacios vacíos entre controles.

## Reglas de componentes
- Cards, tablas, inputs y layout: radios sobrios y estética operativa.
- Chips y badges: pueden mantenerse en formato pill.
- Cards: usar superficies claras, borde sutil y elevación sobria.
- Botones: CTA primario claro, acciones secundarias neutrales, destructivas aisladas.
- DataGrid: headers compactos, hover suave, selected legible, footer integrado.
- Dialogs: overlay con jerarquía clara y transición corta.

## Pantallas de flows
- Filtros principales: `Activos`, `Esperando`, `Finalizados`, `Todos`.
- `Cancelados` no debe competir como filtro principal.
- Los estados críticos deben leerse primero desde color, luego desde texto.
- Recordatorios, registros y acciones rápidas deben compartir un lenguaje visual consistente.
