export type WorkflowVariant = "vertical" | "horizontal" | "timeline";

type WorkflowVariantSwitcherProps = {
  value: WorkflowVariant;
  onChange: (value: WorkflowVariant) => void;
};

const options: Array<{ value: WorkflowVariant; label: string }> = [
  { value: "vertical", label: "Grafo vertical" },
  { value: "horizontal", label: "Grafo horizontal" },
  { value: "timeline", label: "Timeline" }
];

export function WorkflowVariantSwitcher({ value, onChange }: WorkflowVariantSwitcherProps) {
  return (
    <div className="segmented-control">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? "segment active" : "segment"}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

