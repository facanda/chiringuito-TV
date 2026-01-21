"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";

type UploadMode = "file" | "text" | "url";

type ChatMsg = {
  id: string;
  senderRole: "USER" | "ADMIN";
  senderEmail: string;
  text?: string | null;
  imageUrl?: string | null;
  createdAt: string;
};

type AdminInboxItem = {
  id: string; // conversationId
  userEmail: string;
  unread: boolean;
  updatedAt: string;
  lastMessage: null | {
    text: string;
    hasImage: boolean;
    createdAt: string;
    senderRole: string;
  };
};

export default function RightToolbar() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // ===== PLAYLIST =====
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [mode, setMode] = useState<UploadMode>("file");
  const [m3uText, setM3uText] = useState("");
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState<string>("");
  const [busy, setBusy] = useState(false);

  // ===== CHAT =====
  const [showChat, setShowChat] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatErr, setChatErr] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatText, setChatText] = useState("");
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [imgPreview, setImgPreview] = useState<string>("");
  const listRef = useRef<HTMLDivElement | null>(null);

  // ===== ADMIN INBOX (unread + lista usuarios) =====
  const [inbox, setInbox] = useState<AdminInboxItem[]>([]);
  const [unread, setUnread] = useState(0);

  // ===== USER UNREAD =====
  const [userUnread, setUserUnread] = useState(0);

  // ===== ADMIN active convo =====
  const [activeConvo, setActiveConvo] = useState<string>("");

  const email = (session as any)?.user?.email || "";
  const role = String((session as any)?.role || "USER"); // "ADMIN" | "USER"

  const avatar = useMemo(() => {
    const e = String(email || "").trim();
    const c = (e[0] || "U").toUpperCase();
    return /^[A-Z]$/.test(c) ? c : "U";
  }, [email]);

  // cerrar dropdown al hacer click afuera
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return;
      const el = boxRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // cerrar con ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setShowPlaylist(false);
        setShowChat(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // cleanup preview URL
  useEffect(() => {
    return () => {
      if (imgPreview) {
        try {
          URL.revokeObjectURL(imgPreview);
        } catch {}
      }
    };
  }, [imgPreview]);

  if (status !== "authenticated") return null;

  const border = "1px solid rgba(255,255,255,0.12)";
  const panel = "rgba(16,24,39,0.92)";
  const panel2 = "rgba(0,0,0,0.22)";
  const textColor = "white";
  const muted = "rgba(255,255,255,0.75)";

  function go(path: string) {
    setOpen(false);
    if (pathname !== path) router.push(path);
  }

  function goHome() {
    setOpen(false);
    router.push("/");
  }

  // ===== PLAYLIST =====
  function openPlaylistModal() {
    setOpen(false);
    setMsg("");
    setBusy(false);
    setMode("file");
    setM3uText("");
    setUrl("");
    setShowPlaylist(true);
  }

  async function uploadFile(file: File) {
    setMsg("");
    try {
      const t = await file.text();
      setM3uText(t);
      setMode("text");
      setMsg(`Archivo cargado: ${file.name}`);
    } catch {
      setMsg("No se pudo leer el archivo.");
    }
  }

  async function saveText() {
    setMsg("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ m3uText }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || `HTTP ${res.status}`);
        setBusy(false);
        return;
      }

      setMsg("✅ Playlist guardada. Recargando...");
      setTimeout(() => window.location.reload(), 400);
    } catch {
      setMsg("❌ Error de red.");
      setBusy(false);
    }
  }

  async function saveFromUrl() {
    setMsg("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/playlist-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || `HTTP ${res.status}`);
        setBusy(false);
        return;
      }

      setMsg("✅ Playlist guardada desde URL. Recargando...");
      setTimeout(() => window.location.reload(), 400);
    } catch {
      setMsg("❌ Error de red.");
      setBusy(false);
    }
  }

  // ===== CHAT helpers =====
  function scrollToBottom() {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  function openChatModal() {
    setOpen(false);
    setChatErr("");
    setChatText("");
    setImgFile(null);
    if (imgPreview) {
      try {
        URL.revokeObjectURL(imgPreview);
      } catch {}
    }
    setImgPreview("");
    setMessages([]);
    setConversationId("");
    setActiveConvo("");
    setShowChat(true);

    // limpias badges locales al abrir
    setUnread(0);
    setUserUnread(0);
  }

  async function ensureConversation() {
    if (conversationId) return conversationId;

    const res = await fetch("/api/chat/me", { method: "GET" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

    const id = String(data?.conversationId || "");
    if (!id) throw new Error("No se pudo obtener conversationId");
    setConversationId(id);
    return id;
  }

  async function loadMessages(id: string) {
    const res = await fetch(`/api/chat/messages?conversationId=${encodeURIComponent(id)}`, { method: "GET" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

    const arr = Array.isArray(data?.messages) ? (data.messages as ChatMsg[]) : [];
    setMessages(arr);
  }

  async function markRead(id: string) {
    try {
      await fetch("/api/chat/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: id }),
      });
    } catch {}
  }

  async function handlePickImage(file: File | null) {
    setChatErr("");
    setImgFile(null);
    if (imgPreview) {
      try {
        URL.revokeObjectURL(imgPreview);
      } catch {}
    }
    setImgPreview("");

    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setChatErr("Solo imágenes.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setChatErr("Imagen muy grande (máx 4MB).");
      return;
    }

    setImgFile(file);
    try {
      const u = URL.createObjectURL(file);
      setImgPreview(u);
    } catch {}
  }

  async function uploadImageGetUrl(file: File) {
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/chat/upload", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

    const u = String(data?.url || "");
    if (!u) throw new Error("No se pudo subir la imagen");
    return u;
  }

  async function sendMessage() {
    setChatErr("");
    const t = chatText.trim();

    if (!t && !imgFile) {
      setChatErr("Escribe un mensaje o selecciona una imagen.");
      return;
    }

    try {
      setChatBusy(true);

      const id = role === "ADMIN" ? String(activeConvo || "") : await ensureConversation();

      if (role === "ADMIN" && !id) {
        setChatBusy(false);
        setChatErr("Selecciona un usuario primero.");
        return;
      }

      let imageUrl: string | null = null;
      if (imgFile) imageUrl = await uploadImageGetUrl(imgFile);

      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: id, text: t, imageUrl }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      setChatText("");
      setImgFile(null);
      if (imgPreview) {
        try {
          URL.revokeObjectURL(imgPreview);
        } catch {}
      }
      setImgPreview("");

      await loadMessages(id);
      await markRead(id);

      // recargar inbox admin para badge
      if (role === "ADMIN") {
        try {
          await loadAdminInbox();
        } catch {}
      }

      setChatBusy(false);
      setTimeout(scrollToBottom, 30);
    } catch (e: any) {
      setChatBusy(false);
      setChatErr(e?.message || "No se pudo enviar");
    }
  }

  // ===== ADMIN INBOX =====
  async function loadAdminInbox() {
    // tu endpoint actual devuelve { conversations: [...] } (según tu código)
    const res = await fetch("/api/chat/admin/conversations", { method: "GET" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

    const itemsRaw = Array.isArray(data?.conversations) ? (data.conversations as any[]) : [];
    const items: AdminInboxItem[] = itemsRaw.map((c) => ({
      id: String(c.id),
      userEmail: String(c.userEmail || ""),
      unread: Boolean(c.unread && Number(c.unread) > 0),
      updatedAt: String(c.updatedAt || new Date().toISOString()),
      lastMessage: c.lastMessage
        ? {
            text: String(c.lastMessage.text || ""),
            hasImage: Boolean(c.lastMessage.imageUrl),
            createdAt: String(c.lastMessage.createdAt || ""),
            senderRole: String(c.lastMessage.senderRole || ""),
          }
        : null,
    }));

    setInbox(items);
    const totalUnread = itemsRaw.reduce((acc, c) => acc + Number(c.unread || 0), 0);
    setUnread(totalUnread);
  }

  async function openAdminConversation(id: string) {
    setChatErr("");
    setChatBusy(true);
    try {
      setActiveConvo(id);
      await loadMessages(id);
      await markRead(id);
      setChatBusy(false);
      setTimeout(scrollToBottom, 30);

      try {
        await loadAdminInbox();
      } catch {}
    } catch (e: any) {
      setChatBusy(false);
      setChatErr(e?.message || "No se pudo abrir la conversación");
    }
  }

  async function closeAdminConversation() {
    if (!activeConvo) return;
    const ok = confirm("¿Cerrar esta conversación? (se archivará)");
    if (!ok) return;

    try {
      setChatBusy(true);
      const res = await fetch("/api/chat/admin/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeConvo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      setActiveConvo("");
      setMessages([]);
      await loadAdminInbox();
      setChatBusy(false);
    } catch (e: any) {
      setChatBusy(false);
      setChatErr(e?.message || "No se pudo cerrar");
    }
  }

  // ===== USER UNREAD polling =====
  useEffect(() => {
    if (status !== "authenticated") return;
    if (role === "ADMIN") return;

    let t: any = null;

    const tick = async () => {
      try {
        const res = await fetch("/api/chat/unread", { method: "GET" });
        const data = await res.json().catch(() => ({}));
        if (res.ok) setUserUnread(Number(data?.unread || 0));
      } catch {}
    };

    (async () => {
      await tick();
      t = setInterval(tick, 2000);
    })();

    return () => t && clearInterval(t);
  }, [status, role]);

  // ===== ADMIN inbox polling =====
  useEffect(() => {
    if (status !== "authenticated") return;
    if (role !== "ADMIN") return;

    let t: any = null;

    (async () => {
      try {
        await loadAdminInbox();
      } catch {}
      t = setInterval(async () => {
        try {
          await loadAdminInbox();
        } catch {}
      }, 2000);
    })();

    return () => t && clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, role]);

  // ===== cuando abres modal chat, arranca refresco de mensajes =====
  useEffect(() => {
    if (!showChat) return;

    let alive = true;
    let timer: any = null;

    (async () => {
      try {
        setChatBusy(true);

        if (role !== "ADMIN") {
          const id = await ensureConversation();
          if (!alive) return;
          await loadMessages(id);
          if (!alive) return;
          await markRead(id);
        } else {
          // admin: carga inbox y si hay activeConvo también carga mensajes
          try {
            await loadAdminInbox();
          } catch {}
          if (activeConvo) {
            await loadMessages(activeConvo);
            await markRead(activeConvo);
          }
        }

        if (!alive) return;
        setChatBusy(false);
        setTimeout(scrollToBottom, 50);

        timer = setInterval(async () => {
          try {
            if (!alive) return;
            const cid = role === "ADMIN" ? String(activeConvo || "") : String(conversationId || "");
            if (!cid) {
              // aun así refrescamos inbox admin para badge
              if (role === "ADMIN") {
                try {
                  await loadAdminInbox();
                } catch {}
              }
              return;
            }

            await loadMessages(cid);
            await markRead(cid);

            if (role === "ADMIN") {
              try {
                await loadAdminInbox();
              } catch {}
            } else {
              try {
                const res = await fetch("/api/chat/unread", { method: "GET" });
                const data = await res.json().catch(() => ({}));
                if (res.ok) setUserUnread(Number(data?.unread || 0));
              } catch {}
            }
          } catch {}
        }, 2000);
      } catch (e: any) {
        if (!alive) return;
        setChatBusy(false);
        setChatErr(e?.message || "Error cargando chat");
      }
    })();

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showChat, activeConvo]); // 👈 importante: incluye activeConvo para que refresque al cambiar usuario

  // scroll cuando llegan mensajes
  useEffect(() => {
    if (!showChat) return;
    setTimeout(scrollToBottom, 30);
  }, [messages, showChat]);

  const itemStyle: React.CSSProperties = {
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    borderRadius: 10,
    border: "none",
    background: "transparent",
    color: textColor,
    cursor: "pointer",
    fontWeight: 800,
  };

  const homeBtnStyle: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    cursor: "pointer",
    fontWeight: 900,
  };

  return (
    <>
      {/* ===== DROPDOWN ===== */}
      <div ref={boxRef} style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            borderRadius: 12,
            border,
            background: panel2,
            color: textColor,
            cursor: "pointer",
            fontWeight: 900,
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 10,
              display: "grid",
              placeItems: "center",
              background: "rgba(0,0,0,0.35)",
              border,
              fontWeight: 900,
            }}
          >
            {avatar}
          </div>
          Menú ▾
        </button>

        {open ? (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 10px)",
              width: 280,
              borderRadius: 14,
              border,
              background: panel,
              padding: 10,
              boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
              zIndex: 50,
            }}
          >
            <div style={{ padding: 10, borderRadius: 12, border, background: "rgba(0,0,0,0.18)" }}>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 13,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={email}
              >
                {email}
              </div>
              <div style={{ fontSize: 12, color: muted }}>
                <b style={{ color: textColor }}>{role}</b>
              </div>
            </div>

            <div style={{ height: 10 }} />

            <div style={{ display: "grid", gap: 6 }}>
              <button type="button" onClick={goHome} style={itemStyle}>
                🏠 Home
              </button>

              {role === "ADMIN" ? (
                <>
                  <button type="button" onClick={() => go("/admin")} style={itemStyle}>
                    👥 Users
                  </button>

                  <button type="button" onClick={openPlaylistModal} style={itemStyle}>
                    🔄 Recargar Playlist
                  </button>

                  {/* ✅ SOLO 1 BOTÓN: Mantenimiento */}
                  <button type="button" onClick={() => go("/admin/maintenance")} style={itemStyle}>
                    🛠 Mantenimiento
                  </button>
                </>
              ) : null}

              <button
                type="button"
                onClick={openChatModal}
                style={{
                  ...itemStyle,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <span>💬 Chat</span>

                {role === "ADMIN" && unread > 0 ? (
                  <span
                    style={{
                      minWidth: 18,
                      height: 18,
                      borderRadius: 999,
                      padding: "0 6px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#ef4444",
                      color: "white",
                      fontSize: 11,
                      fontWeight: 900,
                    }}
                    title="Mensajes no leídos"
                  >
                    {unread}
                  </span>
                ) : null}

                {role !== "ADMIN" && userUnread > 0 ? (
                  <span
                    style={{
                      minWidth: 18,
                      height: 18,
                      borderRadius: 999,
                      padding: "0 6px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#ef4444",
                      color: "white",
                      fontSize: 11,
                      fontWeight: 900,
                    }}
                    title="Mensajes del admin sin leer"
                  >
                    {userUnread}
                  </span>
                ) : null}
              </button>

              <button type="button" onClick={() => go("/profile")} style={itemStyle}>
                👤 Perfil
              </button>

              <button type="button" onClick={() => go("/profile/password")} style={itemStyle}>
                🔑 Cambiar password
              </button>

              <div style={{ height: 1, background: "rgba(255,255,255,0.10)", margin: "4px 0" }} />

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  signOut({ callbackUrl: "/login" });
                }}
                style={{
                  ...itemStyle,
                  background: "#991b1b",
                  borderRadius: 12,
                  padding: "10px 12px",
                  textAlign: "center",
                }}
              >
                🚪 Cerrar sesión
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* ===== MODAL PLAYLIST ===== */}
      {showPlaylist ? (
        <div
          onClick={() => setShowPlaylist(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 60,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 820,
              borderRadius: 16,
              border,
              background: "rgba(16,24,39,0.98)",
              padding: 14,
              color: "white",
              boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button type="button" onClick={goHome} style={homeBtnStyle} title="Volver a Home">
                  🏠 Home
                </button>
                <div style={{ fontWeight: 900, fontSize: 16 }}>🔄 Recargar Playlist (Subir nueva)</div>
              </div>

              <button
                type="button"
                onClick={() => setShowPlaylist(false)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border,
                  background: "rgba(0,0,0,0.25)",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setMode("file")}
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border,
                  background: mode === "file" ? "rgba(37,99,235,0.22)" : "rgba(0,0,0,0.20)",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                Archivo
              </button>
              <button
                type="button"
                onClick={() => setMode("text")}
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border,
                  background: mode === "text" ? "rgba(37,99,235,0.22)" : "rgba(0,0,0,0.20)",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                Pegar texto
              </button>
              <button
                type="button"
                onClick={() => setMode("url")}
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border,
                  background: mode === "url" ? "rgba(37,99,235,0.22)" : "rgba(0,0,0,0.20)",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                URL
              </button>
            </div>

            {mode === "file" ? (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 14, border, background: "rgba(0,0,0,0.18)" }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Subir archivo .m3u / .m3u8</div>
                <input
                  type="file"
                  accept=".m3u,.m3u8,text/plain"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadFile(f);
                  }}
                />
                <div style={{ marginTop: 8, fontSize: 12, color: muted }}>
                  Al cargar un archivo, se copiará el contenido al modo “Pegar texto” para guardarlo.
                </div>
              </div>
            ) : null}

            {mode === "text" ? (
              <div style={{ marginTop: 12 }}>
                <textarea
                  value={m3uText}
                  onChange={(e) => setM3uText(e.target.value)}
                  placeholder="#EXTM3U ..."
                  style={{
                    width: "100%",
                    minHeight: 240,
                    padding: 12,
                    borderRadius: 12,
                    border,
                    background: "rgba(15,22,36,0.95)",
                    color: "white",
                    outline: "none",
                    resize: "vertical",
                  }}
                />
                <button
                  type="button"
                  disabled={busy || !m3uText.trim()}
                  onClick={saveText}
                  style={{
                    marginTop: 10,
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "none",
                    background: "#2563eb",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: 900,
                    opacity: busy || !m3uText.trim() ? 0.7 : 1,
                  }}
                >
                  {busy ? "Guardando..." : "Guardar playlist"}
                </button>
              </div>
            ) : null}

            {mode === "url" ? (
              <div style={{ marginTop: 12 }}>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 12,
                    border,
                    background: "rgba(15,22,36,0.95)",
                    color: "white",
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  disabled={busy || !url.trim()}
                  onClick={saveFromUrl}
                  style={{
                    marginTop: 10,
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "none",
                    background: "#2563eb",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: 900,
                    opacity: busy || !url.trim() ? 0.7 : 1,
                  }}
                >
                  {busy ? "Guardando..." : "Guardar desde URL"}
                </button>
              </div>
            ) : null}

            {msg ? (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  color: msg.startsWith("✅") ? "#86efac" : msg.startsWith("❌") ? "#fca5a5" : muted,
                }}
              >
                {msg}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ===== MODAL CHAT ===== */}
      {showChat ? (
        <div
          onClick={() => setShowChat(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 70,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 980,
              borderRadius: 18,
              border,
              background: "rgba(16,24,39,0.98)",
              padding: 14,
              color: "white",
              boxShadow: "0 30px 90px rgba(0,0,0,0.55)",
              maxHeight: "85vh",
              overflow: "hidden",
              display: "grid",
              gridTemplateRows: "auto 1fr",
              gap: 10,
            }}
          >
            {/* header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button type="button" onClick={goHome} style={homeBtnStyle} title="Volver a Home">
                  🏠 Home
                </button>

                <div style={{ fontWeight: 900, fontSize: 16 }}>
                  {role === "ADMIN" ? "💬 Chat (ADMIN)" : "💬 Chat con Admin"}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {role === "ADMIN" && activeConvo ? (
                  <button
                    type="button"
                    onClick={closeAdminConversation}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(239,68,68,0.20)",
                      color: "white",
                      cursor: "pointer",
                      fontWeight: 900,
                    }}
                    title="Cerrar conversación"
                  >
                    🧾 Cerrar chat
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => setShowChat(false)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 12,
                    border,
                    background: "rgba(0,0,0,0.25)",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* cuerpo */}
            {role === "ADMIN" ? (
              <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 10, minHeight: 0 }}>
                {/* Lista usuarios */}
                <div
                  style={{
                    borderRadius: 14,
                    border,
                    background: "rgba(0,0,0,0.18)",
                    padding: 10,
                    overflow: "auto",
                    minHeight: 0,
                  }}
                >
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Usuarios</div>

                  {!inbox.length ? <div style={{ color: muted, fontSize: 13 }}>No hay conversaciones.</div> : null}

                  <div style={{ display: "grid", gap: 8 }}>
                    {inbox.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => openAdminConversation(c.id)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: 10,
                          borderRadius: 12,
                          border: "1px solid rgba(255,255,255,0.10)",
                          background: activeConvo === c.id ? "rgba(37,99,235,0.22)" : "rgba(0,0,0,0.20)",
                          color: "white",
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          alignItems: "center",
                        }}
                        title={c.userEmail}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 900,
                              fontSize: 13,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {c.userEmail}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              opacity: 0.8,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {c.lastMessage?.hasImage ? "📷 Imagen" : c.lastMessage?.text || ""}
                          </div>
                        </div>

                        {c.unread ? (
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 999,
                              background: "#ef4444",
                              flex: "0 0 auto",
                            }}
                            title="No leído"
                          />
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chat panel */}
                <div style={{ display: "grid", gridTemplateRows: "1fr auto", gap: 10, minHeight: 0 }}>
                  {/* mensajes */}
                  <div
                    ref={listRef}
                    style={{
                      borderRadius: 14,
                      border,
                      background: "rgba(0,0,0,0.18)",
                      padding: 10,
                      overflow: "auto",
                      minHeight: 0,
                    }}
                  >
                    {chatBusy && !messages.length ? <div style={{ color: muted, fontSize: 13 }}>Cargando...</div> : null}

                    {!activeConvo ? (
                      <div style={{ color: muted, fontSize: 13 }}>Selecciona un usuario para ver el chat 👈</div>
                    ) : null}

                    <div style={{ display: "grid", gap: 10 }}>
                      {messages.map((m) => {
                        const mine = String(m.senderRole) === "ADMIN";
                        return (
                          <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                            <div
                              style={{
                                maxWidth: "78%",
                                borderRadius: 14,
                                border: "1px solid rgba(255,255,255,0.10)",
                                background: mine ? "rgba(37,99,235,0.20)" : "rgba(0,0,0,0.25)",
                                padding: 10,
                              }}
                            >
                              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.70)", marginBottom: 6 }}>
                                {mine ? "TÚ (ADMIN)" : "USER"} • {new Date(m.createdAt).toLocaleString()}
                              </div>

                              {m.imageUrl ? (
                                <div style={{ marginBottom: m.text ? 8 : 0 }}>
                                  <img
                                    src={m.imageUrl}
                                    alt="img"
                                    style={{
                                      width: "100%",
                                      maxWidth: 520,
                                      borderRadius: 12,
                                      border: "1px solid rgba(255,255,255,0.10)",
                                    }}
                                  />
                                </div>
                              ) : null}

                              {m.text ? <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.35 }}>{m.text}</div> : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* composer */}
                  <div
                    style={{
                      borderRadius: 14,
                      border,
                      background: "rgba(0,0,0,0.18)",
                      padding: 10,
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    {chatErr ? <div style={{ color: "#fca5a5", fontSize: 13 }}>{chatErr}</div> : null}

                    {imgPreview ? (
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <img
                          src={imgPreview}
                          alt="preview"
                          style={{
                            width: 140,
                            height: "auto",
                            borderRadius: 12,
                            border: "1px solid rgba(255,255,255,0.10)",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setImgFile(null);
                            if (imgPreview) {
                              try {
                                URL.revokeObjectURL(imgPreview);
                              } catch {}
                            }
                            setImgPreview("");
                          }}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 12,
                            border,
                            background: "rgba(0,0,0,0.22)",
                            color: "white",
                            cursor: "pointer",
                            fontWeight: 900,
                          }}
                        >
                          Quitar imagen
                        </button>
                      </div>
                    ) : null}

                    <textarea
                      value={chatText}
                      onChange={(e) => setChatText(e.target.value)}
                      placeholder={activeConvo ? "Escribe al usuario…" : "Selecciona un usuario primero…"}
                      disabled={!activeConvo}
                      style={{
                        width: "100%",
                        minHeight: 80,
                        padding: 12,
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "rgba(15,22,36,0.95)",
                        color: "white",
                        outline: "none",
                        resize: "vertical",
                        opacity: !activeConvo ? 0.6 : 1,
                      }}
                    />

                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
                      <label
                        style={{
                          display: "inline-flex",
                          gap: 10,
                          alignItems: "center",
                          cursor: activeConvo ? "pointer" : "not-allowed",
                          padding: "10px 12px",
                          borderRadius: 12,
                          border,
                          background: "rgba(0,0,0,0.22)",
                          fontWeight: 900,
                          opacity: activeConvo ? 1 : 0.6,
                        }}
                      >
                        📷 Subir imagen
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          disabled={!activeConvo}
                          onChange={(e) => handlePickImage(e.target.files?.[0] || null)}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={sendMessage}
                        disabled={chatBusy || !activeConvo}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 12,
                          border: "none",
                          background: "#2563eb",
                          color: "white",
                          cursor: chatBusy || !activeConvo ? "not-allowed" : "pointer",
                          fontWeight: 900,
                          opacity: chatBusy || !activeConvo ? 0.75 : 1,
                        }}
                      >
                        {chatBusy ? "Enviando..." : "Enviar"}
                      </button>
                    </div>

                    <div style={{ fontSize: 12, color: muted }}>
                      * Límite: 4MB por imagen. Se guarda en <b>public/chat_uploads</b>.
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // ===== USER VIEW =====
              <div style={{ display: "grid", gridTemplateRows: "1fr auto", gap: 10, minHeight: 0 }}>
                {/* mensajes */}
                <div
                  ref={listRef}
                  style={{
                    borderRadius: 14,
                    border,
                    background: "rgba(0,0,0,0.18)",
                    padding: 10,
                    overflow: "auto",
                    minHeight: 0,
                  }}
                >
                  {chatBusy && !messages.length ? <div style={{ color: muted, fontSize: 13 }}>Cargando chat...</div> : null}

                  {!chatBusy && !messages.length ? (
                    <div style={{ color: muted, fontSize: 13 }}>No hay mensajes todavía. Escribe al admin abajo 👇</div>
                  ) : null}

                  <div style={{ display: "grid", gap: 10 }}>
                    {messages.map((m) => {
                      const mine = String(m.senderRole) !== "ADMIN";
                      return (
                        <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                          <div
                            style={{
                              maxWidth: "78%",
                              borderRadius: 14,
                              border: "1px solid rgba(255,255,255,0.10)",
                              background: mine ? "rgba(37,99,235,0.20)" : "rgba(0,0,0,0.25)",
                              padding: 10,
                            }}
                          >
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.70)", marginBottom: 6 }}>
                              {mine ? "TÚ" : "ADMIN"} • {new Date(m.createdAt).toLocaleString()}
                            </div>

                            {m.imageUrl ? (
                              <div style={{ marginBottom: m.text ? 8 : 0 }}>
                                <img
                                  src={m.imageUrl}
                                  alt="img"
                                  style={{
                                    width: "100%",
                                    maxWidth: 520,
                                    borderRadius: 12,
                                    border: "1px solid rgba(255,255,255,0.10)",
                                  }}
                                />
                              </div>
                            ) : null}

                            {m.text ? <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.35 }}>{m.text}</div> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* composer */}
                <div
                  style={{
                    borderRadius: 14,
                    border,
                    background: "rgba(0,0,0,0.18)",
                    padding: 10,
                    display: "grid",
                    gap: 10,
                  }}
                >
                  {chatErr ? <div style={{ color: "#fca5a5", fontSize: 13 }}>{chatErr}</div> : null}

                  {imgPreview ? (
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <img
                        src={imgPreview}
                        alt="preview"
                        style={{
                          width: 140,
                          height: "auto",
                          borderRadius: 12,
                          border: "1px solid rgba(255,255,255,0.10)",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImgFile(null);
                          if (imgPreview) {
                            try {
                              URL.revokeObjectURL(imgPreview);
                            } catch {}
                          }
                          setImgPreview("");
                        }}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 12,
                          border,
                          background: "rgba(0,0,0,0.22)",
                          color: "white",
                          cursor: "pointer",
                          fontWeight: 900,
                        }}
                      >
                        Quitar imagen
                      </button>
                    </div>
                  ) : null}

                  <textarea
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    placeholder="Escribe tu mensaje…"
                    style={{
                      width: "100%",
                      minHeight: 80,
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(15,22,36,0.95)",
                      color: "white",
                      outline: "none",
                      resize: "vertical",
                    }}
                  />

                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
                    <label
                      style={{
                        display: "inline-flex",
                        gap: 10,
                        alignItems: "center",
                        cursor: "pointer",
                        padding: "10px 12px",
                        borderRadius: 12,
                        border,
                        background: "rgba(0,0,0,0.22)",
                        fontWeight: 900,
                      }}
                    >
                      📷 Subir imagen
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(e) => handlePickImage(e.target.files?.[0] || null)}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={sendMessage}
                      disabled={chatBusy}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 12,
                        border: "none",
                        background: "#2563eb",
                        color: "white",
                        cursor: chatBusy ? "not-allowed" : "pointer",
                        fontWeight: 900,
                        opacity: chatBusy ? 0.75 : 1,
                      }}
                    >
                      {chatBusy ? "Enviando..." : "Enviar"}
                    </button>
                  </div>

                  <div style={{ fontSize: 12, color: muted }}>
                    * Límite: 4MB por imagen. Se guarda en <b>public/chat_uploads</b>.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
