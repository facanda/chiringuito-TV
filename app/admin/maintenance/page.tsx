"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

type MaintState = {
  active: boolean;
  message: string;
  updatedAt: string | null;
};

export default function AdminMaintenancePage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const role = String((session as any)?.role || "USER");
  const isAdmin = role === "ADMIN";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [active, setActive] = useState(false);
  const [message, setMessage] = useState("⚠️ Estamos haciendo mantenimiento. Volvemos en unos minutos.");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const prettyUpdated = useMemo(() => {
    if (!updatedAt) return "—";
    try {
      return new Date(updatedAt).toLocaleString();
    } catch {
      return updatedAt;
    }
  }, [updatedAt]);

  // auth guard
  useEffect(() => {
    if (status === "loading") return;
    if (status !== "authenticated") router.push("/login");
    else if (!isAdmin) router.push("/");
  }, [status, isAdmin, router]);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/public/maintenance", { method: "GET" });
      const data = (await res.json().catch(() => ({}))) as Partial<MaintState>;
      if (!res.ok) throw new Error((data as any)?.error || `HTTP ${res.status}`);

      setActive(Boolean(data.active));
      setMessage(String(data.message || ""));
      setUpdatedAt((data.updatedAt as any) ?? null);
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setErr(e?.message || "No se pudo cargar el estado.");
    }
  }

  useEffect(() => {
    if (!isAdmin || status !== "authenticated") return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, status]);

  async function save(nextActive: boolean) {
    setErr("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive, message }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      setSaving(false);
      await load();

      // Si activaste mantenimiento, normalmente kickea a users (y tú sigues).
      // Pero si en tu backend también te saca a ti por error, te dejo un fallback:
      // (no debería pasar si en /api/admin/maintenance solo incrementas sv de USER)
    } catch (e: any) {
      setSaving(false);
      setErr(e?.message || "No se pudo guardar.");
    }
  }

  if (status !== "authenticated" || !isAdmin) return null;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>🛠 Mantenimiento</div>
            <div style={styles.subtitle}>
              Controla el “modo update” (bloquea login de usuarios y muestra mensaje).
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button type="button" onClick={() => router.push("/")} style={styles.btnGhost}>
              🏠 Home
            </button>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              style={{ ...styles.btn, background: "#991b1b" }}
            >
              🚪 Cerrar sesión
            </button>
          </div>
        </div>

        <div style={styles.hr} />

        {loading ? <div style={styles.muted}>Cargando…</div> : null}
        {err ? <div style={styles.error}>{err}</div> : null}

        {!loading ? (
          <>
            <div style={styles.row}>
              <div>
                <div style={{ fontWeight: 900 }}>Estado</div>
                <div style={styles.muted}>Última actualización: {prettyUpdated}</div>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontWeight: 900, color: active ? "#fbbf24" : "#86efac" }}>
                  {active ? "ACTIVO" : "INACTIVO"}
                </span>

                <button
                  type="button"
                  onClick={() => setActive((v) => !v)}
                  disabled={saving}
                  style={{
                    ...styles.toggle,
                    opacity: saving ? 0.7 : 1,
                    background: active ? "rgba(251,191,36,0.18)" : "rgba(134,239,172,0.12)",
                    borderColor: active ? "rgba(251,191,36,0.35)" : "rgba(134,239,172,0.25)",
                  }}
                  title="Cambiar estado (no guarda aún)"
                >
                  {active ? "🔒 ON" : "✅ OFF"}
                </button>
              </div>
            </div>

            <div style={{ height: 10 }} />

            <div style={{ fontWeight: 900, marginBottom: 8 }}>Mensaje para mostrar en Login</div>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribe el mensaje…"
              style={styles.textarea}
              disabled={saving}
            />

            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "space-between" }}>
              <button type="button" onClick={load} disabled={saving} style={styles.btnGhost}>
                🔄 Recargar estado
              </button>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => save(true)}
                  disabled={saving}
                  style={{ ...styles.btn, background: "#f59e0b" }}
                  title="Activa mantenimiento y aplica el mensaje"
                >
                  {saving ? "Guardando…" : "🔒 Activar mantenimiento"}
                </button>

                <button
                  type="button"
                  onClick={() => save(false)}
                  disabled={saving}
                  style={{ ...styles.btn, background: "#16a34a" }}
                  title="Desactiva mantenimiento"
                >
                  {saving ? "Guardando…" : "✅ Desactivar"}
                </button>
              </div>
            </div>

            <div style={{ height: 14 }} />

            <div style={styles.preview}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Vista previa</div>
              <div style={{ opacity: 0.95 }}>
                {active ? "⚠️ Mantenimiento activo: " : "✅ Mantenimiento apagado: "}
                {message || "—"}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                Nota: cuando está activo, el Login NO debe intentar autenticar (para que no salga “contraseña incorrecta”).
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: 16,
    background: "#0b0f17",
    color: "white",
    fontFamily: "system-ui",
    display: "grid",
    placeItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 840,
    padding: 20,
    borderRadius: 18,
    background: "rgba(16,24,39,0.88)",
    border: "1px solid rgba(255,255,255,0.12)",
    backdropFilter: "blur(10px)",
    boxShadow: "0 30px 90px rgba(0,0,0,0.35)",
  },
  header: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" },
  title: { fontSize: 20, fontWeight: 900 },
  subtitle: { fontSize: 13, opacity: 0.8, marginTop: 4, maxWidth: 520 },
  hr: { height: 1, background: "rgba(255,255,255,0.10)", margin: "14px 0" },
  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  muted: { fontSize: 13, opacity: 0.8 },
  error: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(248,113,113,0.35)",
    background: "rgba(248,113,113,0.12)",
    color: "#fecaca",
    fontSize: 13,
  },
  textarea: {
    width: "100%",
    minHeight: 140,
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,22,36,0.95)",
    color: "white",
    outline: "none",
    resize: "vertical",
  },
  preview: {
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.18)",
  },
  btn: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "none",
    background: "#2563eb",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  },
  btnGhost: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(0,0,0,0.20)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  },
  toggle: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.15)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  },
};
