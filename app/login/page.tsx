"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

const LS_EMAIL = "iptv:login:email";
const LS_PASSWORD = "iptv:login:password";
const LS_REMEMBER = "iptv:login:remember";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ mantenimiento desde backend
  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState(
    "⚠️ Estamos haciendo mantenimiento. Volvemos en unos minutos."
  );

  useEffect(() => {
    // load remember me
    try {
      const r = localStorage.getItem(LS_REMEMBER) === "1";
      setRemember(r);

      const savedEmail = localStorage.getItem(LS_EMAIL) || "";
      setEmail(savedEmail);

      if (r) {
        const savedPass = localStorage.getItem(LS_PASSWORD) || "";
        setPassword(savedPass);
      }
    } catch {}

    // ✅ check maintenance (sin login)
    (async () => {
      try {
        const res = await fetch("/api/public/maintenance", { method: "GET" });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.active) {
          setMaintenance(true);
          setMaintenanceMsg(String(data?.message || maintenanceMsg));
        } else {
          setMaintenance(false);
        }
      } catch {
        // si falla, no bloquees
        setMaintenance(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // ✅ si hay mantenimiento, no intentes login
    if (maintenance) {
      setError("");
      return;
    }

    setLoading(true);

    // guardar credenciales
    try {
      localStorage.setItem(LS_EMAIL, email);
      localStorage.setItem(LS_REMEMBER, remember ? "1" : "0");

      if (remember) localStorage.setItem(LS_PASSWORD, password);
      else localStorage.removeItem(LS_PASSWORD);
    } catch {}

    const res = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error === "MAINTENANCE") {
      // por si cambió justo en el submit
      setMaintenance(true);
      setMaintenanceMsg("⚠️ Estamos haciendo mantenimiento. Volvemos en unos minutos.");
      setError("");
      return;
    }

    if (res?.error) {
      setError("Email o contraseña incorrectos");
      return;
    }

    router.push("/");
  }

  return (
    <div style={styles.page}>
      <div style={styles.bg} />
      <div style={styles.overlay} />

      <form onSubmit={handleSubmit} style={styles.card}>
        <div style={styles.logoWrap}>
          <img
            src="/logo.png"
            alt="Logo"
            style={styles.logo}
            onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
          />
        </div>

        <h1 style={styles.title}>Iniciar sesión</h1>

        {maintenance ? (
          <div style={styles.maintBox}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Mantenimiento</div>
            <div style={{ opacity: 0.95 }}>{maintenanceMsg}</div>
          </div>
        ) : null}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={styles.input}
          disabled={maintenance}
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={styles.input}
          disabled={maintenance}
        />

        <label style={{ ...styles.remember, opacity: maintenance ? 0.6 : 0.9 }}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            disabled={maintenance}
          />
          <span>Recordarme</span>
        </label>

        {error && <div style={styles.error}>{error}</div>}

        <button
          type="submit"
          disabled={loading || maintenance}
          style={{ ...styles.btn, opacity: loading || maintenance ? 0.7 : 1 }}
        >
          {maintenance ? "Mantenimiento..." : loading ? "Entrando..." : "Entrar"}
        </button>

        <div style={styles.links}>
          <button type="button" onClick={() => router.push("/forgot")} style={styles.link} disabled={maintenance}>
            ¿Olvidaste tu contraseña?
          </button>

          <button type="button" onClick={() => router.push("/register")} style={styles.link} disabled={maintenance}>
            Crear cuenta
          </button>
        </div>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    position: "relative",
    overflow: "hidden",
    fontFamily: "system-ui",
    color: "white",
  },
  bg: {
    position: "absolute",
    inset: 0,
    backgroundImage: `url("/login-bg.png")`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    transform: "scale(1.03)",
  },
  overlay: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(circle at 20% 10%, rgba(37,99,235,0.25), transparent 40%), rgba(0,0,0,0.62)",
  },
  card: {
    position: "relative",
    width: "100%",
    maxWidth: 420,
    padding: 26,
    borderRadius: 18,
    background: "rgba(16,24,39,0.82)",
    border: "1px solid rgba(255,255,255,0.12)",
    backdropFilter: "blur(10px)",
  },
  logoWrap: { display: "grid", placeItems: "center", marginBottom: 14 },
  logo: { maxWidth: 160, height: "auto", objectFit: "contain" },
  title: { fontSize: 22, fontWeight: 900, marginBottom: 16, textAlign: "center" },
  maintBox: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(251,191,36,0.35)",
    background: "rgba(251,191,36,0.12)",
    fontSize: 13,
  },
  input: {
    width: "100%",
    padding: 12,
    marginBottom: 12,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(15,22,36,0.9)",
    color: "white",
    outline: "none",
  },
  remember: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 12 },
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
  error: { color: "#f87171", fontSize: 13, marginBottom: 10, textAlign: "center" },
  links: { marginTop: 14, display: "flex", justifyContent: "space-between", gap: 10 },
  link: { background: "transparent", border: "none", color: "#93c5fd", cursor: "pointer", fontSize: 13, padding: 0 },
};
