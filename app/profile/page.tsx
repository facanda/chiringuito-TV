"use client";

import { useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  if (status === "loading") return null;
  if (!session) return null;

  const email = (session as any)?.user?.email || "";
  const role = (session as any)?.role || "USER";

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <button type="button" onClick={() => router.push("/")} style={styles.smallBtn} title="Volver a Home">
            🏠 Home
          </button>

          <h1 style={styles.title}>👤 Perfil</h1>

          <button type="button" onClick={() => router.back()} style={styles.smallBtn} title="Volver atrás">
            ⬅ Volver
          </button>
        </div>

        {/* Info */}
        <div style={styles.box}>
          <div style={styles.row}>
            <span style={styles.label}>Email</span>
            <span style={styles.value} title={email}>
              {email}
            </span>
          </div>

          <div style={{ ...styles.row, borderBottom: "none" }}>
            <span style={styles.label}>Rol</span>
            <span style={styles.value}>{role}</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <button type="button" onClick={() => router.push("/password/reset")} style={styles.btn}>
            🔒 Cambiar contraseña
          </button>

          {role === "ADMIN" ? (
            <button type="button" onClick={() => router.push("/admin")} style={styles.btnGhost}>
              🛠 Ir a Admin
            </button>
          ) : null}

          <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} style={{ ...styles.btn, background: "#991b1b" }}>
            🚪 Cerrar sesión
          </button>
        </div>
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
    maxWidth: 560,
    padding: 24,
    borderRadius: 18,
    background: "rgba(16,24,39,0.85)",
    border: "1px solid rgba(255,255,255,0.12)",
    backdropFilter: "blur(10px)",
  },
  header: {
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    alignItems: "center",
    gap: 10,
  },
  title: { margin: 0, fontSize: 20, fontWeight: 900, textAlign: "center" },
  smallBtn: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(0,0,0,0.20)",
    color: "white",
    cursor: "pointer",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  box: {
    marginTop: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.18)",
    padding: 12,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    padding: "10px 0",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  label: { fontSize: 12, opacity: 0.75 },
  value: {
    fontSize: 12,
    fontWeight: 900,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 320,
    textAlign: "right",
  },
  btn: {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "none",
    background: "#2563eb",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  },
  btnGhost: {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "transparent",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  },
};
