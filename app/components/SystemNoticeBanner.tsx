"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";

type Notice = { text: string; createdAt: string; active: boolean } | null;

export default function SystemNoticeBanner() {
  const { status } = useSession();
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    let t: any = null;

    const tick = async () => {
      try {
        const res = await fetch("/api/system/notice", { method: "GET" });
        const data = await res.json().catch(() => ({}));
        const n = (data?.notice ?? null) as Notice;
        setNotice(n);

        // si hay aviso activo y el usuario está logueado, lo sacamos
        if (n?.active && status === "authenticated") {
          // pequeño delay para que alcance a renderizar el banner
          setTimeout(() => signOut({ callbackUrl: "/login" }), 600);
        }
      } catch {}
    };

    (async () => {
      await tick();
      t = setInterval(tick, 2000);
    })();

    return () => t && clearInterval(t);
  }, [status]);

  if (!notice?.active) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        left: 12,
        right: 12,
        zIndex: 9999,
        padding: "12px 14px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(153,27,27,0.92)",
        color: "white",
        fontFamily: "system-ui",
        boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 4 }}>⚠️ Update en progreso</div>
      <div style={{ opacity: 0.95, whiteSpace: "pre-wrap" }}>{notice.text}</div>
    </div>
  );
}
