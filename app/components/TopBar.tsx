"use client";

import { usePathname } from "next/navigation";
import UserMenu from "./UserMenu";

export default function TopBar() {
  const pathname = usePathname();

  // No mostrar en pantallas públicas
  const hidden =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot" ||
    pathname === "/reset";

  if (hidden) return null;

  return (
    <div style={styles.wrap}>
      <div style={styles.left}>
        <img
          src="/logo.png"
          alt="Logo"
          style={styles.logo}
          onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
        />
        <div style={styles.title}>CHIRINGUITO TV</div>
      </div>

      <UserMenu />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: "sticky",
    top: 0,
    zIndex: 60,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "12px 16px",
    background: "rgba(0, 0, 0, 0.45)", // 🔥 oscuro transparente
    borderBottom: "1px solid rgba(255,255,255,0.12)",
    backdropFilter: "blur(12px)",
  },
  left: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
  logo: {
    width: 56,
    height: "auto",
    objectFit: "contain",
    borderRadius: 12,
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.12)",
    padding: 5,
  },
  title: { fontWeight: 900, fontSize: 14, opacity: 0.9 },
};
