import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { NotFoundPage } from "./features/flow/pages/NotFoundPage";
import { TriggerCreateModal } from "./features/flow/components/TriggerCreateModal";
import { StepDetailPage } from "./features/flow/pages/StepDetailPage";
import { TriggerCreatePage } from "./features/flow/pages/TriggerCreatePage";
import { TriggerDetailPage } from "./features/flow/pages/TriggerDetailPage";
import { TriggerListPage } from "./features/flow/pages/TriggerListPage";
import { WorkflowDetailPage } from "./features/flow/pages/WorkflowDetailPage";

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const isCreateModalOpen = params.get("modal") === "new";

  function closeCreateModal() {
    const nextParams = new URLSearchParams(location.search);
    nextParams.delete("modal");
    const nextSearch = nextParams.toString();
    navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ""}`);
  }

  return (
    <main className="app-shell">
      <header className="app-titlebar">
        <h1>Gestion secuencial de tareas</h1>
      </header>

      <section className="workspace">
        <Routes>
          <Route path="/" element={<Navigate to="/triggers" replace />} />
          <Route path="/dashboard" element={<Navigate to="/triggers" replace />} />
          <Route path="/triggers" element={<TriggerListPage />} />
          <Route path="/triggers/new" element={<TriggerCreatePage />} />
          <Route path="/triggers/:triggerId" element={<TriggerDetailPage />} />
          <Route path="/workflows/:workflowId" element={<WorkflowDetailPage />} />
          <Route path="/steps/:stepId" element={<StepDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </section>

      {isCreateModalOpen && <TriggerCreateModal onClose={closeCreateModal} />}
    </main>
  );
}

export default App;
