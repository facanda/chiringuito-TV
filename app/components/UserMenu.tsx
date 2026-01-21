"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function UserMenu() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const email = (session as any)?.user?.email || "";
  const role = (session as any)?.role || "USER";

  // ✅ Avatar: solo letras A-Z, si empieza con número/símbolo => U
  const initials = useMemo(() => {
    const s = String(email || "").trim();
    const c = (s[0] || "U").toUpperCase();
    return /^[A-Z]$/.test(c) ? c : "U";
  }, [email]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  if (status === "loading") return null;
  if (!session) return null;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={styles.trigger}
        title="Menú"
      >
        <span style={styles.avatar}>{initials}</span>
        <span style={styles.email}>{email}</span>
        <span style={{ opacity: 0.8 }}>▾</span>
      </button>

      {open ? (
        <div style={styles.menu}>
          <div style={styles.menuHeader}>
            <div style={{ fontWeight: 900, fontSize: 13 }}>{email}</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Rol: <b>{role}</b>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push("/profile");
            }}
            style={styles.item}
          >
            👤 Perfil
          </button>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              // ✅ tu ruta real de cambiar password
              router.push("/profile/password");
            }}
            style={styles.item}
          >
            🔒 Cambiar contraseña
          </button>

          {role === "ADMIN" ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/admin");
              }}
              style={styles.item}
            >
              🛠 Admin
            </button>
          ) : null}

          <div style={styles.sep} />

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            style={{ ...styles.item, color: "#fecaca" }}
          >
            🚪 Cerrar sesión
          </button>
        </div>
      ) : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  trigger: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    cursor: "pointer",
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 10,
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    background: "rgba(37,99,235,0.8)",
  },
  email: {
    maxWidth: 220,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 12,
    opacity: 0.95,
    color: "rgba(255,255,255,0.9)", // ✅ mejor en fondo oscuro
  },
  menu: {
    position: "absolute",
    right: 0,
    top: "calc(100% + 8px)",
    width: 260,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(16,24,39,0.92)",
    backdropFilter: "blur(10px)",
    boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
    overflow: "hidden",
    zIndex: 50,
  },
  menuHeader: {
    padding: 12,
    borderBottom: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.15)",
  },
  item: {
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    border: "none",
    background: "transparent",
    color: "white",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 13,
  },
  sep: {
    height: 1,
    background: "rgba(255,255,255,0.10)",
    margin: 6,
  },
};
