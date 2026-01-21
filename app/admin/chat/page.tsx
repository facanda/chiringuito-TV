"use client";

import AdminChatPanel from "@/app/components/AdminChatPanel";

export default function AdminChatPage() {
  return (
    <div style={{ minHeight: "100vh", padding: 16, background: "#0b0f17", color: "white", fontFamily: "system-ui" }}>
      <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>💬 Admin — Chat</div>
      <AdminChatPanel />
    </div>
  );
}
