import { Navigate } from "react-router-dom";

export function TriggerCreatePage() {
  return <Navigate to="/requirements" replace state={{ openCreateRequirement: true }} />;
}
