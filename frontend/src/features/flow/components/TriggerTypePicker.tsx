type TriggerTypePickerProps = {
  selected: string;
  onSelect: (value: string) => void;
};

const triggerOptions = [
  {
    value: "incidente",
    label: "Incidente operativo",
    description: "Corte, error o situacion que necesita resolucion secuencial."
  },
  {
    value: "solicitud",
    label: "Solicitud interna",
    description: "Pedido de negocio o requerimiento que dispara varias tareas."
  },
  {
    value: "mejora",
    label: "Mejora planificada",
    description: "Cambio estructurado con diagnostico, ejecucion y verificacion."
  }
];

export function TriggerTypePicker({ selected, onSelect }: TriggerTypePickerProps) {
  return (
    <div className="option-stack">
      {triggerOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          className={selected === option.value ? "option-card selected" : "option-card"}
          onClick={() => onSelect(option.value)}
        >
          <div className="option-icon">+</div>
          <div className="option-body">
            <strong>{option.label}</strong>
            <p>{option.description}</p>
          </div>
          <span className="option-check">{selected === option.value ? "OK" : ""}</span>
        </button>
      ))}
    </div>
  );
}

