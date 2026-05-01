import { humanizeStatus } from "../utils";

type StatusBadgeProps = {
  value: string;
};

export function StatusBadge({ value }: StatusBadgeProps) {
  return <span className={`status-badge status-${value}`}>{humanizeStatus(value)}</span>;
}

