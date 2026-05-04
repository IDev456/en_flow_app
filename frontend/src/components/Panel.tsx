import { PropsWithChildren } from "react";
import { Card, CardContent, Typography } from "@mui/material";

type PanelProps = PropsWithChildren<{
  title: string;
}>;

export function Panel({ title, children }: PanelProps) {
  return (
    <Card>
      <CardContent sx={{ display: "grid", gap: 2 }}>
        <Typography variant="h5">{title}</Typography>
        {children}
      </CardContent>
    </Card>
  );
}
