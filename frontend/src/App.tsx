import AddCircleOutlineRoundedIcon from "@mui/icons-material/AddCircleOutlineRounded";
import AssignmentTurnedInRoundedIcon from "@mui/icons-material/AssignmentTurnedInRounded";
import { AppBar, Box, Button, Container, Stack, Toolbar, Typography } from "@mui/material";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { NotFoundPage } from "./features/flow/pages/NotFoundPage";
import { TriggerCreateModal } from "./features/flow/components/TriggerCreateModal";
import { DashboardPage } from "./features/flow/pages/DashboardPage";
import { StepDetailPage } from "./features/flow/pages/StepDetailPage";
import { TriggerCreatePage } from "./features/flow/pages/TriggerCreatePage";
import { TriggerDetailPage } from "./features/flow/pages/TriggerDetailPage";
import { TriggerListPage } from "./features/flow/pages/TriggerListPage";
import { WorkflowDetailPage } from "./features/flow/pages/WorkflowDetailPage";

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const isCreateModalOpen = params.get("modal") === "capture";

  function closeCreateModal() {
    const nextParams = new URLSearchParams(location.search);
    nextParams.delete("modal");
    const nextSearch = nextParams.toString();
    navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ""}`);
  }

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <AppBar
        position="sticky"
        color="transparent"
        sx={{
          backgroundColor: "rgba(10, 15, 27, 0.78)",
        }}
      >
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ minHeight: 80, gap: 2, justifyContent: "space-between" }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 3,
                  display: "grid",
                  placeItems: "center",
                  background: "linear-gradient(135deg, rgba(94, 168, 255, 0.22), rgba(115, 214, 197, 0.24))",
                  border: "1px solid rgba(147, 169, 198, 0.18)",
                }}
              >
                <AssignmentTurnedInRoundedIcon color="primary" />
              </Box>
              <Box>
                <Typography variant="subtitle2" color="primary.light">
                  En Flow
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Bandeja diaria de trabajo
                </Typography>
              </Box>
            </Stack>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.25}
              sx={{ alignItems: { xs: "stretch", sm: "center" } }}
            >
              <Button variant="text" color="inherit" onClick={() => navigate("/board")}>
                Bandeja
              </Button>
              <Button variant="text" color="inherit" onClick={() => navigate("/flows")}>
                Flows
              </Button>
              <Button variant="text" color="inherit" onClick={() => navigate("/requirements")}>
                Requerimientos
              </Button>
              <Button
                variant="contained"
                startIcon={<AddCircleOutlineRoundedIcon />}
                onClick={() => navigate(`${location.pathname}?modal=capture`)}
              >
                Capturar tarea
              </Button>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      <Container
        maxWidth="xl"
        sx={{
          py: { xs: 3, md: 4 },
        }}
      >
        <Box>
          <Routes>
            <Route path="/" element={<Navigate to="/board" replace />} />
            <Route path="/dashboard" element={<Navigate to="/board" replace />} />
            <Route path="/board" element={<DashboardPage />} />
            <Route path="/flows" element={<TriggerListPage defaultView="flows" lockView title="Flows" />} />
            <Route path="/requirements" element={<TriggerListPage defaultView="requirements" lockView title="Requerimientos" />} />
            <Route path="/triggers" element={<Navigate to="/requirements" replace />} />
            <Route path="/triggers/new" element={<TriggerCreatePage />} />
            <Route path="/requirements/:triggerId" element={<TriggerDetailPage />} />
            <Route path="/triggers/:triggerId" element={<TriggerDetailPage />} />
            <Route path="/workflows/:workflowId" element={<WorkflowDetailPage />} />
            <Route path="/steps/:stepId" element={<StepDetailPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Box>
      </Container>
      {isCreateModalOpen && <TriggerCreateModal onClose={closeCreateModal} />}
    </Box>
  );
}

export default App;
