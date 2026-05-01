type WizardStepperProps = {
  current: number;
  items: string[];
};

export function WizardStepper({ current, items }: WizardStepperProps) {
  return (
    <div className="wizard-stepper">
      {items.map((item, index) => {
        const stepNumber = index + 1;
        const state = stepNumber < current ? "done" : stepNumber === current ? "active" : "idle";
        return (
          <div key={item} className="wizard-step">
            <div className={`wizard-bullet ${state}`}>{state === "done" ? "OK" : stepNumber}</div>
            <span>{item}</span>
            {index < items.length - 1 && <div className="wizard-line" />}
          </div>
        );
      })}
    </div>
  );
}

