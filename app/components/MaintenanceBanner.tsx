"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function MaintenanceBanner() {
  const { data: session, status } = useSession();
  const role = String((session as any)?.role || "USER");

  const [active, setActive] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let t: any = null;

    const tick = async () => {
      try {
        const res = await fetch("/api/app-config", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setActive(Boolean(data?.maintenanceActive));
          setMessage(String(data?.maintenanceMessage || ""));
        }
      } catch {}
    };

    tick();
    t = setInterval(tick, 2000);
    return () => t && clearInterval(t);
  }, []);

  // Si está activo, mostrar a todos (incluye admin) como banner informativo
  if (!active) return null;

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 999,
        padding: "10px 12px",
        background: "rgba(239,68,68,0.18)",
        borderBottom: "1px solid rgba(239,68,68,0.35)",
        color: "white",
        fontFamily: "system-ui",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>
          🛠 Mantenimiento activo
          <span style={{ fontWeight: 600, marginLeft: 8, opacity: 0.9 }}>{message}</span>
        </div>

        {status === "authenticated" ? (
          <div style={{ opacity: 0.85, fontWeight: 800 }}>
            Rol: <span style={{ opacity: 1 }}>{role}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
