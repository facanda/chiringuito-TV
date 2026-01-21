"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
  isBlocked: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
};

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const role = useMemo(
    () => (session?.user as any)?.role || (session as any)?.role || "USER",
    [session]
  );

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const [q, setQ] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (!session) router.push("/login");
  }, [status, session, router]);

  useEffect(() => {
    if (!session || role !== "ADMIN") return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, role]);

  async function refresh() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) return setMsg(data?.error || `Error HTTP ${res.status}`);
      setUsers(data.users || []);
    } catch {
      setLoading(false);
      setMsg("Error de red.");
    }
  }

  async function blockUser(id: string, isBlocked: boolean) {
    setMsg("");
    try {
      const res = await fetch(`/api/admin/users/${id}/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBlocked }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setMsg(data?.error || `Error HTTP ${res.status}`);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, isBlocked } : u)));
    } catch {
      setMsg("Error de red.");
    }
  }

  async function kickUser(id: string) {
    setMsg("");
    try {
      const res = await fetch(`/api/admin/users/${id}/kick`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setMsg(data?.error || `Error HTTP ${res.status}`);
      setMsg("✅ Sesión cerrada (kick) aplicado.");
    } catch {
      setMsg("Error de red.");
    }
  }

  async function setPassword(id: string) {
    const newPassword = prompt("Nueva contraseña (mín 6):");
    if (!newPassword) return;

    setMsg("");
    try {
      const res = await fetch(`/api/admin/users/${id}/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setMsg(data?.error || `Error HTTP ${res.status}`);
      setMsg(`✅ Password actualizado para ${data.user.email} (kick aplicado).`);
    } catch {
      setMsg("Error de red.");
    }
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) => u.email.toLowerCase().includes(s) || (u.name || "").toLowerCase().includes(s));
  }, [users, q]);

  if (status === "loading") return null;
  if (!session) return null;

  if (role !== "ADMIN") {
    return (
      <div style={{ padding: 20, fontFamily: "system-ui" }}>
        <h2>No autorizado</h2>
        <p>Solo ADMIN puede ver esta página.</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.top}>
          <h2 style={{ margin: 0 }}>Usuarios</h2>
          <button onClick={refresh} style={styles.btn}>
            {loading ? "Actualizando..." : "Refrescar"}
          </button>
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por email o nombre…"
          style={styles.input}
        />

        {msg ? (
          <div style={{ marginTop: 10, fontSize: 13, color: msg.startsWith("✅") ? "#16a34a" : "#dc2626" }}>
            {msg}
          </div>
        ) : null}

        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          {filtered.map((u) => (
            <div key={u.id} style={styles.row}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, wordBreak: "break-word" }}>
                  {u.email}{" "}
                  <span style={{ fontWeight: 700, opacity: 0.7 }}>({u.role})</span>
                </div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {u.name ? `Nombre: ${u.name} • ` : ""}
                  Creado: {new Date(u.createdAt).toLocaleString()}
                  {u.lastLoginAt ? ` • Último login: ${new Date(u.lastLoginAt).toLocaleString()}` : ""}
                  {u.lastLoginIp ? ` • IP: ${u.lastLoginIp}` : ""}
                </div>
                {u.isBlocked ? (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#dc2626", fontWeight: 800 }}>
                    BLOQUEADO
                  </div>
                ) : null}
              </div>

              <div style={styles.actions}>
                <button
                  onClick={() => blockUser(u.id, !u.isBlocked)}
                  style={{ ...styles.smallBtn, background: u.isBlocked ? "#16a34a" : "#dc2626" }}
                >
                  {u.isBlocked ? "Desbloquear" : "Bloquear"}
                </button>

                <button onClick={() => kickUser(u.id)} style={{ ...styles.smallBtn, background: "#111827" }}>
                  Kick
                </button>

                <button onClick={() => setPassword(u.id)} style={{ ...styles.smallBtn, background: "#2563eb" }}>
                  Reset pass
                </button>
              </div>
            </div>
          ))}

          {!filtered.length ? (
            <div style={{ fontSize: 13, opacity: 0.7, padding: 10 }}>No hay usuarios.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", padding: 16, display: "grid", placeItems: "center", fontFamily: "system-ui" },
  card: {
    width: "100%",
    maxWidth: 980,
    borderRadius: 16,
    padding: 16,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
  },
  top: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
  btn: { padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)", background: "white", cursor: "pointer", fontWeight: 800 },
  input: { width: "100%", marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)" },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.10)",
  },
  actions: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" },
  smallBtn: { padding: "9px 10px", borderRadius: 12, border: "none", color: "white", fontWeight: 900, cursor: "pointer" },
};
