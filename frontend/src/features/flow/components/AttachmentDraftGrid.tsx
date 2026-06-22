import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import InsertDriveFileRoundedIcon from "@mui/icons-material/InsertDriveFileRounded";
import { Box, Card, CardContent, IconButton, Stack, Typography } from "@mui/material";

import type { LocalAttachmentDraft } from "../utils/attachments";
import { attachmentToPreviewSrc, formatAttachmentFileSize } from "../utils/attachments";

type AttachmentDraftGridProps = {
  attachments: LocalAttachmentDraft[];
  onRemove?: (localId: string) => void;
};

export function AttachmentDraftGrid({ attachments, onRemove }: AttachmentDraftGridProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.25,
        gridTemplateColumns: { xs: "1fr", sm: "repeat(auto-fit, minmax(220px, 1fr))" },
      }}
    >
      {attachments.map((attachment) => (
        <Card key={attachment.local_id} variant="outlined">
          <CardContent sx={{ display: "grid", gap: 1.25 }}>
            <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between" }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontWeight: 700 }}>
                  {attachment.nombre}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatAttachmentFileSize(attachment.size_bytes)}
                </Typography>
              </Box>
              {onRemove ? (
                <IconButton size="small" onClick={() => onRemove(attachment.local_id)}>
                  <CloseRoundedIcon fontSize="small" />
                </IconButton>
              ) : null}
            </Stack>
            {attachment.content_type.startsWith("image/") ? (
              <Box
                component="img"
                src={attachmentToPreviewSrc(attachment)}
                alt={attachment.nombre}
                sx={{
                  width: "100%",
                  maxHeight: 220,
                  objectFit: "cover",
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                }}
              />
            ) : (
              <Stack
                spacing={1}
                sx={{
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 120,
                  borderRadius: 2,
                  border: "1px dashed",
                  borderColor: "divider",
                }}
              >
                <InsertDriveFileRoundedIcon color="action" />
                <Typography variant="body2" color="text.secondary">
                  Archivo listo para enviar
                </Typography>
              </Stack>
            )}
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
