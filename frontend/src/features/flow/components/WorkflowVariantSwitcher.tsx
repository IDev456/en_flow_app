import { ToggleButton, ToggleButtonGroup } from "@mui/material";

export type WorkflowVariant = "vertical" | "gitlog";

type WorkflowVariantSwitcherProps = {
  value: WorkflowVariant;
  onChange: (value: WorkflowVariant) => void;
};

const options: Array<{ value: WorkflowVariant; label: string }> = [
  { value: "vertical", label: "Grafo vertical" },
  { value: "gitlog", label: "Git log" }
];

export function WorkflowVariantSwitcher({ value, onChange }: WorkflowVariantSwitcherProps) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      onChange={(_, nextValue: WorkflowVariant | null) => {
        if (nextValue) {
          onChange(nextValue);
        }
      }}
    >
      {options.map((option) => (
        <ToggleButton
          key={option.value}
          value={option.value}
        >
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
