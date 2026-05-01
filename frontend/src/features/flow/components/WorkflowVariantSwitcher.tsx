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
