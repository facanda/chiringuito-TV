import { Suspense } from "react";
import ResetClient from "./ResetClient";

export default function ResetPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: "white" }}>Cargando…</div>}>
      <ResetClient />
    </Suspense>
  );
}
