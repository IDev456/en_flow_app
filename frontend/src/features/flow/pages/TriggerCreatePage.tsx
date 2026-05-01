import { Navigate } from "react-router-dom";

export function TriggerCreatePage() {
  return <Navigate to="/triggers?modal=new" replace />;
}
