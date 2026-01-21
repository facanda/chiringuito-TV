"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

export default function ResetClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const email = useMemo(() => sp.get("email") || "", [sp]);
  const token = useMemo(() => sp.get("token") || "", [sp]);

  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);

  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("");

    if (!email || !token) {
      setStatus("Link inválido o incompleto.");
      return;
    }

    if (p1.length < 6) {
      setStatus("La contraseña debe tener mínimo 6 caracteres.");
      return;
    }

    if (p1 !== p2) {
      setStatus("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          token,
          newPassword: p1,
        }),
      });

      const data = await res.json().catch(() => ({}));
      setLoading(false);

      if (!res.ok) {
        setStatus(data?.error || `Error HTTP ${res.status}`);
        return;
      }

      setStatus("✅ Contraseña actualizada. Redirigiendo a login...");
      setTimeout(() => router.push("/login"), 900);
    } catch {
      setLoading(false);
      setStatus("Error de red.");
    }
  }

  return (
    <div style={styles.page}>
      <style jsx global>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <div style={styles.overlay} />

      <div style={styles.center}>
        <form onSubmit={onSubmit} style={styles.card}>
          {/* Logo + título */}
          <div style={styles.brandWrap}>
            <img
              src="/logo.png"
              alt="IPTV Logo"
              style={styles.logoImg}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />

            <div style={styles.brandText}>
              <div style={styles.brandTitle}>Nueva contraseña</div>
              <div style={styles.brandSubtitle}>
                {email ? (
                  <>
                    Email: <b style={{ color: "white" }}>{email}</b>
                  </>
                ) : (
                  "Link inválido"
                )}
              </div>
            </div>
          </div>

          {/* Nueva contraseña */}
          <div style={{ position: "relative", marginBottom: 12 }}>
            <input
              type={show1 ? "text" : "password"}
              placeholder="Nueva contraseña (mín 6)"
              value={p1}
              onChange={(e) => setP1(e.target.value)}
              required
              style={{ ...styles.input, marginBottom: 0, paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setShow1((v) => !v)}
              aria-label="Mostrar/ocultar nueva contraseña"
              title={show1 ? "Ocultar" : "Mostrar"}
              style={styles.eyeBtn}
            >
              {show1 ? "🙈" : "👁️"}
            </button>
          </div>

          {/* Confirmación */}
          <div style={{ position: "relative", marginBottom: 12 }}>
            <input
              type={show2 ? "text" : "password"}
              placeholder="Confirmar contraseña"
              value={p2}
              onChange={(e) => setP2(e.target.value)}
              required
              style={{ ...styles.input, marginBottom: 0, paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setShow2((v) => !v)}
              aria-label="Mostrar/ocultar confirmación"
              title={show2 ? "Ocultar" : "Mostrar"}
              style={styles.eyeBtn}
            >
              {show2 ? "🙈" : "👁️"}
            </button>
          </div>

          {status ? (
            <div
              style={{
                marginTop: 10,
                fontSize: 13,
                color: status.startsWith("✅") ? "#22c55e" : "#f87171",
              }}
            >
              {status}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || !email || !token}
            style={{
              ...styles.primaryBtn,
              opacity: loading || !email || !token ? 0.75 : 1,
              cursor: loading || !email || !token ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Guardando..." : "Cambiar contraseña"}
          </button>

          <button type="button" onClick={() => router.push("/login")} style={styles.ghostBtn}>
            Volver a login
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 16,
    fontFamily: "system-ui",
    color: "white",
    position: "relative",
    overflow: "hidden",
    backgroundImage: "url('/login-bg.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  },
  overlay: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(circle at 30% 20%, rgba(0,0,0,0.35), rgba(0,0,0,0.78) 70%)",
    backdropFilter: "blur(3px)",
  },
  center: {
    position: "relative",
    width: "100%",
    display: "grid",
    placeItems: "center",
    zIndex: 1,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    padding: 24,
    borderRadius: 18,
    background: "rgba(16, 24, 39, 0.92)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
    animation: "fadeUp 420ms ease-out",
  },
  brandWrap: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    marginBottom: 14,
  },
  logoImg: {
    width: 56,
    height: 56,
    objectFit: "contain",
    borderRadius: 14,
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.15)",
    padding: 6,
  },
  brandText: { display: "grid", gap: 2 },
  brandTitle: { fontSize: 20, fontWeight: 900, lineHeight: 1.1 },
  brandSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.7)" },
  input: {
    width: "100%",
    padding: 12,
    marginBottom: 12,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(15, 22, 36, 0.95)",
    color: "white",
    outline: "none",
  },
  eyeBtn: {
    position: "absolute",
    right: 8,
    top: "50%",
    transform: "translateY(-50%)",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 18,
    padding: 6,
    color: "white",
    opacity: 0.9,
  },
  primaryBtn: {
    marginTop: 14,
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "none",
    background: "#2563eb",
    color: "white",
    fontWeight: 800,
  },
  ghostBtn: {
    marginTop: 10,
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "transparent",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
  },
};
