"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function ProfilePasswordPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (!currentPassword || !newPassword || !confirm) {
      setErr("Completa todos los campos.");
      return;
    }
    if (newPassword.length < 6) {
      setErr("La nueva contraseña debe tener mínimo 6 caracteres.");
      return;
    }
    if (newPassword !== confirm) {
      setErr("La confirmación no coincide.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/password/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data?.error || `Error HTTP ${res.status}`);
        setLoading(false);
        return;
      }

      setMsg("✅ Contraseña actualizada.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch {
      setErr("Error de red.");
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading") return null;
  if (!session) return null;

  const border = "1px solid rgba(255,255,255,0.12)";
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: border,
    background: "rgba(15,22,36,0.95)",
    color: "white",
    outline: "none",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0b0f17",
        color: "white",
        fontFamily: "system-ui",
        padding: 16,
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          width: "100%",
          maxWidth: 520,
          borderRadius: 16,
          border: border,
          background: "rgba(16,24,39,0.85)",
          padding: 16,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>
          Cambiar contraseña
        </div>
        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 14 }}>
          Usuario: <b>{session.user?.email}</b>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <input
            type="password"
            placeholder="Contraseña actual"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Nueva contraseña (mín 6)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Confirmar nueva contraseña"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            style={inputStyle}
          />
        </div>

        {err ? <div style={{ marginTop: 10, color: "#f87171" }}>{err}</div> : null}
        {msg ? <div style={{ marginTop: 10, color: "#34d399" }}>{msg}</div> : null}

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 14,
            width: "100%",
            padding: 12,
            borderRadius: 12,
            border: "none",
            background: "#2563eb",
            color: "white",
            fontWeight: 900,
            cursor: "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Guardando..." : "Guardar"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/")}
          style={{
            marginTop: 10,
            width: "100%",
            padding: 12,
            borderRadius: 12,
            border: border,
            background: "transparent",
            color: "white",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Volver
        </button>
      </form>
    </div>
  );
}
