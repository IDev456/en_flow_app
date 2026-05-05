import { Navigate } from "react-router-dom";

export function TriggerCreatePage() {
  return <Navigate to="/flows?modal=capture" replace />;
}
