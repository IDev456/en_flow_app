# UI_GUIDELINES.md

## 1. Objetivo
Este documento define criterios visuales para mantener coherencia en pantallas, componentes, colores, estados, espaciados y experiencia de usuario en la aplicación.

## 2. Regla principal
La aplicación debe conservar su estructura y distribución actual.  
El template de Material UI Dashboard se usa solo como referencia estética, no como layout a copiar.

## 3. Referencia visual
Referencia: https://github.com/mui/material-ui/tree/v9.0.1/docs/data/material/getting-started/templates/dashboard

Se toma como referencia para:
- Colores
- Componentes
- Cards
- Botones
- Chips
- Tablas
- Tipografía
- Bordes
- Sombras
- Espaciados
- Jerarquía visual

## 4. Qué está permitido
Se puede mejorar:
- Colores
- Cards
- Botones
- Chips de estado
- Tablas
- Inputs
- Espaciados internos
- Jerarquía visual
- Consistencia entre pantallas

## 5. Qué no está permitido salvo pedido explícito
No se debe:
- Cambiar la navegación principal
- Cambiar la distribución general
- Reemplazar pantallas completas
- Reorganizar módulos
- Copiar el layout del dashboard template
- Introducir un sidebar nuevo si la app no lo usa
- Cambiar rutas
- Hacer refactors generales

## 6. Uso de Material UI
Priorizar componentes de Material UI antes de crear CSS personalizado:
- Box
- Stack
- Grid
- Paper
- Card
- CardContent
- Typography
- Button
- IconButton
- Chip
- Tabs
- Tab
- TextField
- Select
- MenuItem
- Dialog
- Alert
- Tooltip
- DataGrid, solo si ya está en uso o si se pide explícitamente

## 7. Colores
Usar colores del theme de Material UI:
- primary
- secondary
- success
- warning
- error
- info
- background.default
- background.paper
- text.primary
- text.secondary

Reglas:
- No hardcodear colores salvo necesidad puntual.
- No usar rojo salvo error real.
- No usar warning salvo advertencia real.
- Mantener contraste suficiente.

## 8. Cards y paneles
Criterios:
- Fondo limpio
- Borde o sombra suave
- Padding consistente
- Títulos claros
- Texto secundario discreto
- Acciones bien ubicadas
- Evitar sombras exageradas o estilos distintos por pantalla

## 9. Botones
Jerarquía:
- Acción principal: contained
- Acción secundaria: outlined
- Acción simple: text
- Acción destructiva: color error solo si corresponde

## 10. Chips de estado
Los estados deben representarse con Chip cuando corresponda.

Ejemplo para Flows:
- Activo
- Esperando
- Finalizado

Reglas:
- Mantener textos breves.
- Usar colores consistentes.
- No inventar estados visuales que no existan funcionalmente.
- No usar rojo salvo problema real.

## 11. Filtros
Los filtros deben mantener la estructura actual de cada pantalla.

Para Flows, el orden debe ser:
1. Activos
2. Esperando
3. Finalizados
4. Todos

Reglas:
- Todos debe ir al final.
- No mostrar filtros sin uso real.
- No usar Pausado o Problema si no son estados funcionales reales.
- No cambiar lógica del filtro salvo pedido explícito.

## 12. Tablas y listados
Reglas:
- Mantener estructura actual.
- Mejorar legibilidad, encabezados, chips de estado, acciones por fila y espaciado.
- No reemplazar una tabla completa por otra solución sin autorización.

## 13. Tipografía
Usar variantes de Material UI:
- h4 o h5 para títulos principales
- h6 para títulos de sección
- body1 para contenido
- body2 para texto secundario
- caption para detalles menores

## 14. Espaciado
Reglas:
- Usar Stack, Grid y Box.
- Mantener spacing consistente.
- Mejorar padding interno sin alterar layout global.
- No mover bloques principales sin pedido explícito.

## 15. Modo claro / oscuro
Reglas:
- No hardcodear fondos blancos.
- No hardcodear textos negros.
- Usar tokens del theme.
- Verificar contraste en ambos modos si existen.

## 16. Reglas para IA / Codex
Pasos obligatorios:
- Leer PROJECT_CONTEXT.md, AI_WORKFLOW.md, LOCAL_MODEL_INSTRUCTIONS.md y UI_GUIDELINES.md.
- Identificar pantalla o componente a modificar.
- Mantener distribución actual.
- Usar el template de MUI Dashboard solo como referencia estética.
- Aplicar el cambio mínimo necesario.
- No hacer refactors generales.
- No cambiar navegación, rutas ni organización global.
- No introducir nuevas dependencias visuales sin autorización.

## 17. Checklist de revisión
Antes de cerrar un cambio de UI:
- Se mantuvo la distribución actual.
- No se cambió navegación ni estructura general.
- Los colores se acercan al estilo MUI Dashboard.
- Los componentes usan Material UI de forma consistente.
- No se copiaron pantallas completas del template.
- No se agregaron dependencias innecesarias.
- Los estados y filtros siguen siendo funcionalmente correctos.
- La pantalla sigue funcionando igual, pero se ve más limpia y consistente.
