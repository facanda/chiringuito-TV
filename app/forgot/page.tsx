"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ForgotPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [resetUrl, setResetUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("");
    setResetUrl("");
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      const res = await fetch("/api/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json().catch(() => ({}));
      setLoading(false);

      // Debug útil (si algo falla lo ves en consola)
      console.log("forgot response:", res.status, data);

      if (!res.ok) {
        setStatus(data?.error || `Error HTTP ${res.status}`);
        return;
      }

      setStatus(data?.message || "Listo.");

      // Importante: guardar resetUrl si viene
      if (data?.resetUrl) {
        setResetUrl(String(data.resetUrl));
      } else {
        setResetUrl("");
      }
    } catch {
      setLoading(false);
      setStatus("Error de red.");
    }
  }

  const fullResetLink =
    resetUrl && resetUrl.startsWith("http")
      ? resetUrl
      : resetUrl
      ? `${window.location.origin}${resetUrl}`
      : "";

  return (
    <div style={styles.page}>
      <div style={styles.overlay} />

      <div style={styles.center}>
        <form onSubmit={handleSubmit} style={styles.card}>
          <div style={styles.brandWrap}>
            <img
              src="/logo.png"
              alt="Logo"
              style={styles.logoImg}
              onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
            />
            <div style={styles.brandText}>
              <div style={styles.brandTitle}>Recuperar contraseña</div>
              <div style={styles.brandSubtitle}>Escribe tu email y generamos un link</div>
            </div>
          </div>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
          />

          {status ? <div style={styles.status}>{status}</div> : null}

          {/* Aquí mostramos el link SIEMPRE que exista */}
          {fullResetLink ? (
            <div style={styles.linkBox}>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
                Link de reset:
              </div>

              <div style={styles.linkText}>{fullResetLink}</div>

              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => router.push(resetUrl)}
                  style={{ ...styles.primaryBtn, background: "#22c55e", marginTop: 0 }}
                >
                  Abrir link
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(fullResetLink);
                      setStatus("✅ Link copiado.");
                    } catch {
                      setStatus("No se pudo copiar (permiso del navegador).");
                    }
                  }}
                  style={{ ...styles.ghostBtn, marginTop: 0 }}
                >
                  Copiar
                </button>
              </div>
            </div>
          ) : null}

          <button type="submit" disabled={loading} style={styles.primaryBtn}>
            {loading ? "Generando..." : "Generar link"}
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
  center: { position: "relative", width: "100%", display: "grid", placeItems: "center", zIndex: 1 },
  card: {
    width: "100%",
    maxWidth: 460,
    padding: 24,
    borderRadius: 18,
    background: "rgba(16, 24, 39, 0.92)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
  },
  brandWrap: { display: "flex", gap: 12, alignItems: "center", marginBottom: 14 },
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
  brandTitle: { fontSize: 20, fontWeight: 900 },
  brandSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.7)" },
  input: {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(15, 22, 36, 0.95)",
    color: "white",
    outline: "none",
  },
  status: { marginTop: 10, fontSize: 13, color: "rgba(255,255,255,0.85)" },
  linkBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.25)",
  },
  linkText: {
    fontSize: 12,
    wordBreak: "break-all",
    padding: 10,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.25)",
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
    cursor: "pointer",
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
