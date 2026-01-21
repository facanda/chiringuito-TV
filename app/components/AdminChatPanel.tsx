"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Convo = {
  id: string;
  userEmail: string;
  updatedAt: string;
  messagesCount: number;
  lastMessage: null | {
    text: string;
    imageUrl?: string | null;
    createdAt: string;
    senderRole: string;
  };
};

type ChatMsg = {
  id: string;
  senderRole: "USER" | "ADMIN";
  senderEmail: string;
  text: string;
  imageUrl?: string | null;
  createdAt: string;
};

export default function AdminChatPanel() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [convos, setConvos] = useState<Convo[]>([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);

  const border = "1px solid rgba(255,255,255,0.12)";
  const panel = "rgba(16,24,39,0.85)";
  const panel2 = "rgba(0,0,0,0.22)";
  const muted = "rgba(255,255,255,0.75)";
  const textColor = "white";

  function scrollBottom() {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  async function loadConversations() {
    const res = await fetch("/api/chat/admin/conversations", { method: "GET" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

    const arr = Array.isArray(data?.conversations) ? (data.conversations as Convo[]) : [];
    setConvos(arr);

    // si no hay activo, toma el primero
    setActiveId((prev) => prev || (arr[0]?.id || ""));
  }

  async function loadMessages(conversationId: string) {
    if (!conversationId) return;
    const res = await fetch(`/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}`, { method: "GET" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

    const arr = Array.isArray(data?.messages) ? (data.messages as ChatMsg[]) : [];
    setMessages(arr);
  }

  // polling pro (cada 2s)
  useEffect(() => {
    let alive = true;
    let timer: any = null;

    (async () => {
      try {
        setLoading(true);
        setErr("");
        await loadConversations();
        setLoading(false);

        timer = setInterval(async () => {
          try {
            if (!alive) return;
            await loadConversations();
            if (activeId) await loadMessages(activeId);
          } catch {
            // silencioso
          }
        }, 2000);
      } catch (e: any) {
        if (!alive) return;
        setLoading(false);
        setErr(e?.message || "Error");
      }
    })();

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // carga mensajes cuando cambia conversación
  useEffect(() => {
    if (!activeId) return;
    (async () => {
      try {
        setErr("");
        await loadMessages(activeId);
        setTimeout(scrollBottom, 30);
      } catch (e: any) {
        setErr(e?.message || "Error cargando mensajes");
      }
    })();
  }, [activeId]);

  useEffect(() => {
    setTimeout(scrollBottom, 30);
  }, [messages]);

  const active = useMemo(() => convos.find((c) => c.id === activeId) || null, [convos, activeId]);

  async function send() {
    setErr("");
    const t = text.trim();
    if (!activeId) return setErr("Selecciona una conversación.");
    if (!t) return setErr("Escribe un mensaje.");

    try {
      setBusy(true);
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeId, text: t }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      setText("");
      await loadMessages(activeId);
      await loadConversations();
      setBusy(false);
      setTimeout(scrollBottom, 30);
    } catch (e: any) {
      setBusy(false);
      setErr(e?.message || "No se pudo enviar");
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 12, minHeight: "70vh" }}>
      {/* Inbox */}
      <div style={{ borderRadius: 16, border, background: panel, padding: 12, overflow: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 16, color: textColor }}>💬 Inbox</div>
          <button
            type="button"
            onClick={() => {
              loadConversations().catch(() => {});
              if (activeId) loadMessages(activeId).catch(() => {});
            }}
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              border,
              background: panel2,
              color: textColor,
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            ↻
          </button>
        </div>

        {loading ? <div style={{ color: muted, fontSize: 13 }}>Cargando…</div> : null}
        {err ? <div style={{ color: "#fca5a5", fontSize: 13, marginBottom: 8 }}>{err}</div> : null}

        <div style={{ display: "grid", gap: 8 }}>
          {convos.map((c) => {
            const isActive = c.id === activeId;
            const last = c.lastMessage;
            const preview = last?.imageUrl ? "📷 Imagen" : (last?.text || "").slice(0, 60);

            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveId(c.id)}
                style={{
                  textAlign: "left",
                  width: "100%",
                  borderRadius: 14,
                  border: isActive ? "1px solid rgba(239,68,68,0.85)" : "1px solid rgba(255,255,255,0.10)",
                  background: isActive ? "rgba(239,68,68,0.14)" : "rgba(0,0,0,0.18)",
                  padding: 10,
                  cursor: "pointer",
                  color: textColor,
                  boxShadow: isActive ? "0 10px 30px rgba(0,0,0,0.45)" : "none",
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.userEmail}
                </div>

                <div style={{ fontSize: 12, color: muted, marginTop: 4, display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview || "(sin mensajes)"}</span>
                  <span style={{ whiteSpace: "nowrap" }}>{c.messagesCount}</span>
                </div>

                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>
                  {new Date(c.updatedAt).toLocaleString()}
                </div>
              </button>
            );
          })}

          {!loading && !convos.length ? <div style={{ color: muted, fontSize: 13 }}>No hay conversaciones.</div> : null}
        </div>
      </div>

      {/* Chat */}
      <div style={{ borderRadius: 16, border, background: panel, padding: 12, display: "grid", gridTemplateRows: "auto 1fr auto", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ color: textColor }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Chat</div>
            <div style={{ fontSize: 12, color: muted }}>{active ? active.userEmail : "Selecciona un usuario"}</div>
          </div>
        </div>

        <div
          ref={listRef}
          style={{
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(0,0,0,0.18)",
            padding: 10,
            overflow: "auto",
            minHeight: 420,
          }}
        >
          {!activeId ? <div style={{ color: muted, fontSize: 13 }}>Selecciona una conversación.</div> : null}

          <div style={{ display: "grid", gap: 10 }}>
            {messages.map((m) => {
              const mine = m.senderRole === "ADMIN";
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
                      {mine ? "ADMIN" : "USER"} • {new Date(m.createdAt).toLocaleString()}
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

        <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.10)", background: panel2, padding: 10 }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe como ADMIN…"
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
              marginBottom: 10,
            }}
          />

          <button
            type="button"
            onClick={send}
            disabled={busy}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "none",
              background: "#2563eb",
              color: "white",
              cursor: "pointer",
              fontWeight: 900,
              opacity: busy ? 0.75 : 1,
              width: "100%",
            }}
          >
            {busy ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}
