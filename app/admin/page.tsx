"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Role = "ADMIN" | "USER";

type AdminUserRow = {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  isBlocked?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export default function AdminUsersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string>("");
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<AdminUserRow[]>([]);

  async function loadUsers() {
    setErr("");
    try {
      setLoading(true);
      const res = await fetch("/api/admin/users", { method: "GET" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const items = Array.isArray(data?.items) ? (data.items as AdminUserRow[]) : [];
      setRows(items);
    } catch (e: any) {
      setErr(e?.message || "No se pudo cargar usuarios");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((u) => {
      const email = (u.email || "").toLowerCase();
      const name = String(u.name || "").toLowerCase();
      return email.includes(s) || name.includes(s) || String(u.id).toLowerCase().includes(s);
    });
  }, [q, rows]);

  async function setRole(userId: string, role: Role) {
    setErr("");
    setOkMsg("");
    setSavingId(userId);

    const prev = rows;
    setRows((r) => r.map((u) => (u.id === userId ? { ...u, role } : u)));

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      setOkMsg("✅ Rol actualizado");
    } catch (e: any) {
      setErr(e?.message || "No se pudo actualizar rol");
      setRows(prev);
    } finally {
      setSavingId("");
      setTimeout(() => setOkMsg(""), 1500);
    }
  }

  const border = "1px solid rgba(255,255,255,0.12)";
  const bg = "rgba(16,24,39,0.92)";
  const panel = "rgba(0,0,0,0.20)";

  return (
    <div style={{ padding: 16, color: "white" }}>
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          border,
          borderRadius: 16,
          background: bg,
          padding: 14,
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        }}
      >
        {/* ✅ TOP BAR: Home + título */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            onClick={() => router.push("/")}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border,
              background: "rgba(0,0,0,0.20)",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
            title="Volver a Home"
          >
            🏠 Home
          </button>

          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>👥 Admin / Users</div>
            <div style={{ opacity: 0.75, fontSize: 13 }}>Cambiar rol de ADMIN ⇄ USER</div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por email / nombre / id..."
              style={{
                width: 320,
                maxWidth: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border,
                background: panel,
                color: "white",
                outline: "none",
              }}
            />

            <button
              type="button"
              onClick={loadUsers}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border,
                background: "rgba(37,99,235,0.18)",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              🔄 Recargar
            </button>
          </div>
        </div>

        {err ? (
          <div style={{ marginTop: 12, color: "#fca5a5", fontWeight: 800 }}>{err}</div>
        ) : okMsg ? (
          <div style={{ marginTop: 12, color: "#86efac", fontWeight: 800 }}>{okMsg}</div>
        ) : null}

        <div style={{ marginTop: 12, borderRadius: 14, border, overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr 160px 140px",
              gap: 10,
              padding: 12,
              background: "rgba(0,0,0,0.28)",
              fontWeight: 900,
              fontSize: 13,
            }}
          >
            <div>Email</div>
            <div>Nombre</div>
            <div>Rol</div>
            <div>Acción</div>
          </div>

          <div style={{ background: "rgba(0,0,0,0.18)" }}>
            {loading ? (
              <div style={{ padding: 12, opacity: 0.8 }}>Cargando...</div>
            ) : !filtered.length ? (
              <div style={{ padding: 12, opacity: 0.8 }}>No hay usuarios.</div>
            ) : (
              filtered.map((u) => {
                const busy = savingId === u.id;
                return (
                  <div
                    key={u.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.4fr 1fr 160px 140px",
                      gap: 10,
                      padding: 12,
                      borderTop: "1px solid rgba(255,255,255,0.08)",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 900,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={u.email}
                      >
                        {u.email}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.7 }} title={u.id}>
                        {u.id}
                      </div>
                    </div>

                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: 0.9 }}>
                      {u.name || "—"}
                    </div>

                    <div>
                      <select
                        value={u.role}
                        disabled={busy}
                        onChange={(e) => {
                          const nextRole = String(e.target.value) as Role;
                          setRows((r) => r.map((x) => (x.id === u.id ? { ...x, role: nextRole } : x)));
                        }}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 12,
                          border,
                          background: "rgba(0,0,0,0.25)",
                          color: "white",
                          outline: "none",
                          cursor: busy ? "not-allowed" : "pointer",
                          fontWeight: 900,
                        }}
                      >
                        <option value="USER">USER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </div>

                    <div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setRole(u.id, u.role)}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 12,
                          border: "none",
                          background: "#2563eb",
                          color: "white",
                          fontWeight: 900,
                          cursor: busy ? "not-allowed" : "pointer",
                          opacity: busy ? 0.75 : 1,
                        }}
                      >
                        {busy ? "Guardando..." : "Guardar"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
          Tip: Si cambias un usuario a ADMIN, puede que necesite volver a iniciar sesión para refrescar el rol.
        </div>
      </div>
    </div>
  );
}
