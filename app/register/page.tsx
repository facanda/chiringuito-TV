"use client";

import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // (opcional) auto-focus email si quieres
  useEffect(() => {
    // nada
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const e1 = email.trim().toLowerCase();
    if (!e1) return setError("Email requerido.");

    if (password.length < 6) return setError("La contraseña debe tener mínimo 6 caracteres.");
    if (password !== password2) return setError("Las contraseñas no coinciden.");

    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e1, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setLoading(false);
        setError(data?.error || `Error HTTP ${res.status}`);
        return;
      }

      // ✅ Auto-login luego de registrarse
      const login = await signIn("credentials", {
        email: e1,
        password,
        redirect: false,
      });

      setLoading(false);

      if (login?.error) {
        router.push("/login");
        return;
      }

      router.push("/");
    } catch {
      setLoading(false);
      setError("Error de red.");
    }
  }

  return (
    <div style={styles.page}>
      {/* fondo */}
      <div style={styles.bg} />
      {/* overlay */}
      <div style={styles.overlay} />

      <form onSubmit={handleSubmit} style={styles.card}>
        {/* LOGO */}
        <div style={styles.logoWrap}>
          <img
            src="/logo.png"
            alt="Logo"
            style={styles.logo}
            onError={(e) =>
              ((e.currentTarget as HTMLImageElement).style.display = "none")
            }
          />
        </div>

        <h1 style={styles.title}>Crear cuenta</h1>
        <p style={styles.sub}>
          Regístrate para acceder
        </p>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={styles.input}
        />

        <input
          type="password"
          placeholder="Contraseña (mín 6)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={styles.input}
        />

        <input
          type="password"
          placeholder="Repetir contraseña"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          required
          style={styles.input}
        />

        {error && <div style={styles.error}>{error}</div>}

        <button type="submit" disabled={loading} style={styles.btn}>
          {loading ? "Creando..." : "Crear cuenta"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/login")}
          style={styles.btnGhost}
        >
          Ya tengo cuenta (Login)
        </button>
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
  title: { fontSize: 22, fontWeight: 900, marginBottom: 6, textAlign: "center" },
  sub: { fontSize: 13, opacity: 0.75, marginBottom: 16, textAlign: "center" },
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
  btn: {
    marginTop: 4,
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "none",
    background: "#2563eb",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    opacity: 1,
  },
  btnGhost: {
    marginTop: 10,
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "transparent",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
  },
  error: {
    color: "#f87171",
    fontSize: 13,
    marginBottom: 10,
    textAlign: "center",
  },
};
