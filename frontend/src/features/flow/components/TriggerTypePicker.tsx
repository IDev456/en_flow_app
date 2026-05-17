import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import { Card, CardActionArea, CardContent, Stack, Typography } from "@mui/material";

type TriggerTypePickerProps = {
  selected: string;
  onSelect: (value: string) => void;
};

const triggerOptions = [
  {
    value: "incidente",
    label: "Incidente operativo",
    description: "Corte, error o situación que necesita resolución secuencial.",
  },
  {
    value: "solicitud",
    label: "Solicitud interna",
    description: "Pedido de negocio o proyecto que dispara varias tareas.",
  },
  {
    value: "mejora",
    label: "Mejora planificada",
    description: "Cambio estructurado con diagnóstico, ejecución y verificación.",
  },
];

export function TriggerTypePicker({ selected, onSelect }: TriggerTypePickerProps) {
  return (
    <Stack spacing={1.5} role="radiogroup" aria-label="Selecciona el tipo de trigger">
      {triggerOptions.map((option) => {
        const isSelected = selected === option.value;
        return (
          <Card key={option.value} variant="outlined" sx={{ borderColor: isSelected ? "primary.main" : "divider" }}>
            <CardActionArea onClick={() => onSelect(option.value)} role="radio" aria-checked={isSelected}>
              <CardContent>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
                  <Stack spacing={0.5}>
                    <Typography variant="h6">{option.label}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {option.description}
                    </Typography>
                  </Stack>
                  {isSelected ? <CheckCircleRoundedIcon color="primary" /> : <RadioButtonUncheckedRoundedIcon color="disabled" />}
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        );
      })}
    </Stack>
  );
}
