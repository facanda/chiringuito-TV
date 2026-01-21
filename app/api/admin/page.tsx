"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import RightToolbar from "@/app/components/RightToolbar";

type UserRow = {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  isBlocked: boolean;
  sessionVersion: number;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  createdAt: string;
};

type LogRow = {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  targetId: string | null;
  target: string | null;
  meta: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

function fmtDate(v: string | null) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return v;
  }
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session as any)?.role || "USER";

  const [tab, setTab] = useState<"users" | "logs">("users");

  // users
  const [users, setUsers] = useState<UserRow[]>([]);
  const [uq, setUq] = useState("");

  // logs
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [lq, setLq] = useState("");
  const [laction, setLaction] = useState("");

  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && role !== "ADMIN") router.push("/");
  }, [status, role, router]);

  async function loadUsers() {
    setMsg("");
    setBusy(true);
    try {
      const qs = new URLSearchParams();
      if (uq.trim()) qs.set("q", uq.trim());
      qs.set("take", "200");

      const res = await fetch(`/api/admin/users?${qs.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      setUsers(data?.users || []);
    } catch {
      setMsg("Error de red cargando users.");
    } finally {
      setBusy(false);
    }
  }

  async function loadLogs() {
    setMsg("");
    setBusy(true);
    try {
      const qs = new URLSearchParams();
      if (lq.trim()) qs.set("q", lq.trim());
      if (laction.trim()) qs.set("action", laction.trim());
      qs.set("take", "150");

      const res = await fetch(`/api/admin/audit?${qs.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      setLogs(data?.logs || []);
    } catch {
      setMsg("Error de red cargando logs.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (status === "authenticated" && role === "ADMIN") {
      loadUsers();
      loadLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, role]);

  async function blockUser(id: string, isBlocked: boolean) {
    setMsg("");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBlocked }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      await loadUsers();
      await loadLogs();
    } catch {
      setMsg("Error de red.");
    } finally {
      setBusy(false);
    }
  }

  async function kickUser(id: string) {
    setMsg("");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/kick`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      await loadUsers();
      await loadLogs();
    } catch {
      setMsg("Error de red.");
    } finally {
      setBusy(false);
    }
  }

  const border = "1px solid rgba(255,255,255,0.10)";
  const panel = "rgba(16,24,39,0.85)";
  const panel2 = "rgba(0,0,0,0.20)";
  const text = "white";
  const muted = "rgba(255,255,255,0.75)";

  const actionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const l of logs) set.add(l.action);
    return ["", ...Array.from(set).sort()];
  }, [logs]);

  if (status === "loading") return null;
  if (!session) return null;
  if (role !== "ADMIN") return null;

  return (
    <div style={{ minHeight: "100vh", padding: 16, background: "#0b0f17", color: text, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>📊 Panel Admin</div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setTab("users")}
              style={{
                padding: "8px 12px",
                borderRadius: 12,
                border,
                background: tab === "users" ? "rgba(37,99,235,0.22)" : panel2,
                color: text,
                cursor: "pointer",
                fontWeight: 900,
              }}
            >
              👥 Users
            </button>
            <button
              type="button"
              onClick={() => setTab("logs")}
              style={{
                padding: "8px 12px",
                borderRadius: 12,
                border,
                background: tab === "logs" ? "rgba(37,99,235,0.22)" : panel2,
                color: text,
                cursor: "pointer",
                fontWeight: 900,
              }}
            >
              🧾 Logs
            </button>
          </div>
        </div>

        <RightToolbar />
      </div>

      {msg ? (
        <div style={{ marginBottom: 10, color: "#fca5a5", fontSize: 13 }}>{msg}</div>
      ) : null}

      {/* USERS TAB */}
      {tab === "users" ? (
        <div style={{ borderRadius: 16, border, background: panel, padding: 12, overflow: "auto" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            <input
              value={uq}
              onChange={(e) => setUq(e.target.value)}
              placeholder="Buscar email…"
              style={{
                flex: 1,
                minWidth: 220,
                padding: 10,
                borderRadius: 12,
                border,
                background: "rgba(15,22,36,0.95)",
                color: text,
                outline: "none",
              }}
            />

            <button
              type="button"
              onClick={loadUsers}
              disabled={busy}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border,
                background: panel2,
                color: text,
                cursor: "pointer",
                fontWeight: 900,
                opacity: busy ? 0.7 : 1,
              }}
            >
              🔄 Recargar
            </button>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: muted, textAlign: "left" }}>
                <th style={{ padding: 10 }}>Email</th>
                <th style={{ padding: 10 }}>Role</th>
                <th style={{ padding: 10 }}>Blocked</th>
                <th style={{ padding: 10 }}>Último login</th>
                <th style={{ padding: 10 }}>IP</th>
                <th style={{ padding: 10 }}>Creado</th>
                <th style={{ padding: 10 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderTop: border }}>
                  <td style={{ padding: 10, fontWeight: 900 }}>{u.email}</td>
                  <td style={{ padding: 10 }}>{u.role}</td>
                  <td style={{ padding: 10 }}>{u.isBlocked ? "✅" : "—"}</td>
                  <td style={{ padding: 10 }}>{fmtDate(u.lastLoginAt)}</td>
                  <td style={{ padding: 10 }}>{u.lastLoginIp || "—"}</td>
                  <td style={{ padding: 10 }}>{fmtDate(u.createdAt)}</td>
                  <td style={{ padding: 10 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => kickUser(u.id)}
                        disabled={busy}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 12,
                          border,
                          background: panel2,
                          color: text,
                          cursor: "pointer",
                          fontWeight: 900,
                          opacity: busy ? 0.7 : 1,
                        }}
                        title="Cierra la sesión del usuario (lo saca)"
                      >
                        🔌 Kick
                      </button>

                      {u.isBlocked ? (
                        <button
                          type="button"
                          onClick={() => blockUser(u.id, false)}
                          disabled={busy}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 12,
                            border: "none",
                            background: "#16a34a",
                            color: "white",
                            cursor: "pointer",
                            fontWeight: 900,
                            opacity: busy ? 0.7 : 1,
                          }}
                        >
                          ✅ Desbloquear
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => blockUser(u.id, true)}
                          disabled={busy}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 12,
                            border: "none",
                            background: "#991b1b",
                            color: "white",
                            cursor: "pointer",
                            fontWeight: 900,
                            opacity: busy ? 0.7 : 1,
                          }}
                        >
                          ⛔ Bloquear
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {!users.length ? (
                <tr>
                  <td colSpan={7} style={{ padding: 12, color: muted }}>
                    No hay usuarios.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* LOGS TAB */}
      {tab === "logs" ? (
        <div style={{ borderRadius: 16, border, background: panel, padding: 12, overflow: "auto" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            <input
              value={lq}
              onChange={(e) => setLq(e.target.value)}
              placeholder="Buscar (email/target/action/meta)…"
              style={{
                flex: 1,
                minWidth: 220,
                padding: 10,
                borderRadius: 12,
                border,
                background: "rgba(15,22,36,0.95)",
                color: text,
                outline: "none",
              }}
            />

            <select
              value={laction}
              onChange={(e) => setLaction(e.target.value)}
              style={{
                padding: 10,
                borderRadius: 12,
                border,
                background: "rgba(15,22,36,0.95)",
                color: text,
                cursor: "pointer",
              }}
              title="Filtrar por acción"
            >
              <option value="">(todas)</option>
              {actionOptions.filter(Boolean).map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={loadLogs}
              disabled={busy}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border,
                background: panel2,
                color: text,
                cursor: "pointer",
                fontWeight: 900,
                opacity: busy ? 0.7 : 1,
              }}
            >
              🔄 Recargar
            </button>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: muted, textAlign: "left" }}>
                <th style={{ padding: 10 }}>Fecha</th>
                <th style={{ padding: 10 }}>Acción</th>
                <th style={{ padding: 10 }}>Actor</th>
                <th style={{ padding: 10 }}>Target</th>
                <th style={{ padding: 10 }}>IP</th>
                <th style={{ padding: 10 }}>Meta</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} style={{ borderTop: border }}>
                  <td style={{ padding: 10, whiteSpace: "nowrap" }}>{fmtDate(l.createdAt)}</td>
                  <td style={{ padding: 10, fontWeight: 900 }}>{l.action}</td>
                  <td style={{ padding: 10 }}>{l.actorEmail || l.actorId || "—"}</td>
                  <td style={{ padding: 10 }}>{l.target || l.targetId || "—"}</td>
                  <td style={{ padding: 10 }}>{l.ip || "—"}</td>
                  <td style={{ padding: 10, maxWidth: 420 }}>
                    <div style={{ color: "rgba(255,255,255,0.85)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {l.meta || "—"}
                    </div>
                  </td>
                </tr>
              ))}

              {!logs.length ? (
                <tr>
                  <td colSpan={6} style={{ padding: 12, color: muted }}>
                    No hay logs.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
