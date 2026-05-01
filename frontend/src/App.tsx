import { NavLink, Route, Routes } from "react-router-dom";

import { DashboardPage } from "./features/flow/pages/DashboardPage";
import { NotFoundPage } from "./features/flow/pages/NotFoundPage";
import { StepDetailPage } from "./features/flow/pages/StepDetailPage";
import { TriggerCreatePage } from "./features/flow/pages/TriggerCreatePage";
import { TriggerDetailPage } from "./features/flow/pages/TriggerDetailPage";
import { TriggerListPage } from "./features/flow/pages/TriggerListPage";
import { WorkflowDetailPage } from "./features/flow/pages/WorkflowDetailPage";

const navigationItems = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/triggers", label: "Requerimientos" },
  { to: "/triggers/new", label: "Nuevo" }
];

function App() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">F</div>
          <div>
            <p className="brand-kicker">Flow</p>
            <h1>Gestion secuencial de tareas</h1>
          </div>
        </div>
        <nav className="main-nav" aria-label="Principal">
          {navigationItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <section className="workspace">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/triggers" element={<TriggerListPage />} />
          <Route path="/triggers/new" element={<TriggerCreatePage />} />
          <Route path="/triggers/:triggerId" element={<TriggerDetailPage />} />
          <Route path="/workflows/:workflowId" element={<WorkflowDetailPage />} />
          <Route path="/steps/:stepId" element={<StepDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </section>
    </main>
  );
}

export default App;
