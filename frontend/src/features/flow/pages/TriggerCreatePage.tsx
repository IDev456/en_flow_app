import { Navigate } from "react-router-dom";

export function TriggerCreatePage() {
  return <Navigate to="/board?modal=capture" replace />;
}
