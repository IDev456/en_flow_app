import { useEffect, useMemo, useState } from "react";
import InboxRoundedIcon from "@mui/icons-material/InboxRounded";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { Link as RouterLink } from "react-router-dom";

import { DataGridEmptyState } from "../../../components/feedback/DataGridEmptyState";
import { PageContainer } from "../../../components/layout/PageContainer";
import { listWorkLogEntries } from "../api";
import type { WorkLogEntry, WorkLogEntryType } from "../types";
import { formatDate } from "../utils";

type WorkLogRow = WorkLogEntry;

function getEntryTypeLabel(entryType: WorkLogEntryType) {
  if (entryType === "comment") return "Comentario";
  if (entryType === "status_change") return "Cambio de estado";
  if (entryType === "field_change") return "Cambio de campo";
  if (entryType === "external_event") return "Evento externo";
  return entryType;
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function WorkLogPage() {
  const [entries, setEntries] = useState<WorkLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    void loadEntries();
  }, []);

  async function loadEntries() {
    try {
      setLoading(true);
      setError(null);
      const data = await listWorkLogEntries();
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la bitácora.");
    } finally {
      setLoading(false);
    }
  }

  const filteredRows = useMemo(() => {
    const normalizedSearch = normalizeSearch(searchValue);
    if (!normalizedSearch) return entries;

    return entries.filter((entry) => {
      const searchable = [
        getEntryTypeLabel(entry.entry_type),
        entry.summary,
        entry.step_name,
        entry.workflow_title ?? "",
        entry.requirement_title ?? "",
        entry.author,
      ]
        .map(normalizeSearch)
        .join(" ");
      return searchable.includes(normalizedSearch);
    });
  }, [entries, searchValue]);

  const columns = useMemo<GridColDef<WorkLogRow>[]>(
    () => [
      {
        field: "timestamp",
        headerName: "Fecha/Hora",
        width: 190,
        minWidth: 180,
        valueGetter: (_, row) => row.timestamp,
        renderCell: (params) => (
          <Typography variant="body2" color="text.secondary">
            {formatDate(params.row.timestamp)}
          </Typography>
        ),
      },
      {
        field: "entry_type",
        headerName: "Tipo",
        width: 170,
        minWidth: 160,
        valueGetter: (_, row) => getEntryTypeLabel(row.entry_type),
        renderCell: (params) => (
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {getEntryTypeLabel(params.row.entry_type)}
          </Typography>
        ),
      },
      {
        field: "summary",
        headerName: "Resumen",
        flex: 1.6,
        minWidth: 320,
        renderCell: (params) => (
          <Typography
            variant="body2"
            sx={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              whiteSpace: "normal",
              lineHeight: 1.25,
            }}
          >
            {params.row.summary}
          </Typography>
        ),
      },
      {
        field: "step_name",
        headerName: "Tarea",
        flex: 1.1,
        minWidth: 220,
        valueGetter: (_, row) => row.step_name,
        renderCell: (params) => (
          <Button
            component={RouterLink}
            to={`/steps/${params.row.step_id}`}
            size="small"
            color="inherit"
            endIcon={<LaunchRoundedIcon fontSize="small" />}
            sx={{ textTransform: "none", justifyContent: "flex-start", px: 0.4 }}
          >
            {params.row.step_name}
          </Button>
        ),
      },
      {
        field: "workflow_title",
        headerName: "Flow",
        flex: 1,
        minWidth: 220,
        valueGetter: (_, row) => row.workflow_title ?? `Flow ${row.workflow_id.slice(0, 8)}`,
        renderCell: (params) => (
          <Button
            component={RouterLink}
            to={`/workflows/${params.row.workflow_id}`}
            size="small"
            color="inherit"
            endIcon={<LaunchRoundedIcon fontSize="small" />}
            sx={{ textTransform: "none", justifyContent: "flex-start", px: 0.4 }}
          >
            {params.row.workflow_title ?? `Flow ${params.row.workflow_id.slice(0, 8)}`}
          </Button>
        ),
      },
      {
        field: "requirement_title",
        headerName: "Proyecto",
        flex: 1,
        minWidth: 220,
        valueGetter: (_, row) => row.requirement_title ?? "Sin proyecto",
        renderCell: (params) => {
          if (!params.row.requirement_id) {
            return (
              <Typography variant="body2" color="text.secondary">
                Sin proyecto
              </Typography>
            );
          }
          return (
            <Button
              component={RouterLink}
              to={`/requirements/${params.row.requirement_id}`}
              size="small"
              color="inherit"
              endIcon={<LaunchRoundedIcon fontSize="small" />}
              sx={{ textTransform: "none", justifyContent: "flex-start", px: 0.4 }}
            >
              {params.row.requirement_title ?? `Proyecto ${params.row.requirement_id.slice(0, 8)}`}
            </Button>
          );
        },
      },
      {
        field: "author",
        headerName: "Autor",
        width: 160,
        minWidth: 150,
      },
    ],
    []
  );

  return (
    <PageContainer
      title="Bitácora"
      subtitle="Registro cronológico global de trabajos realizados"
      actions={
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<RefreshRoundedIcon />}
          onClick={() => void loadEntries()}
          disabled={loading}
        >
          Actualizar
        </Button>
      }
    >
      <Stack spacing={1.2}>
        <TextField
          size="small"
          label="Buscar en bitácora"
          placeholder="Tipo, resumen, tarea, flow, proyecto o autor"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          sx={{ maxWidth: 520 }}
        />

        {error ? <Alert severity="error">{error}</Alert> : null}

        <Paper variant="outlined" sx={{ height: "70vh", minHeight: 520, overflow: "hidden" }}>
          <DataGrid
            rows={filteredRows}
            columns={columns}
            loading={loading}
            getRowId={(row) => row.id}
            disableRowSelectionOnClick
            pageSizeOptions={[25, 50, 100]}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 25, page: 0 },
              },
              sorting: {
                sortModel: [{ field: "timestamp", sort: "desc" }],
              },
            }}
            slots={{
              noRowsOverlay: () => (
                <DataGridEmptyState
                  icon={<InboxRoundedIcon color="action" />}
                  title="Sin registros todavía"
                  description="Cuando haya comentarios, cambios o eventos externos, vas a verlos acá."
                />
              ),
            }}
            localeText={{
              noRowsLabel: loading ? "Cargando..." : "Sin registros para mostrar.",
            }}
          />
        </Paper>
      </Stack>
    </PageContainer>
  );
}
