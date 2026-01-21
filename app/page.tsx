"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import RightToolbar from "./components/RightToolbar";

type Channel = {
  id: string;
  name: string;
  url: string;
  group: string;
  logo?: string;
};

type RecentItem = {
  name: string;
  url: string;
  group: string;
  logo?: string;
  at: number;
};

const LS_LAST = "iptv:lastChannel:v1";
const LS_RECENTS = "iptv:recents:v1";
const LS_FAVS = "iptv:favs:v1";

// ✅ Player prefs (volumen/mute/calidad/autoplay)
const LS_PLAYER = "iptv:player:v1";
type PlayerPrefs = {
  volume: number; // 0..1
  muted: boolean;
  level: number; // -1 auto
  userInteracted: boolean;
};

// ✅ UPDATE #6: guardar progreso por canal (resume)
const LS_PROGRESS = "iptv:progress:v1";
type ProgressMap = Record<
  string,
  {
    t: number; // seconds
    at: number; // timestamp
  }
>;

function makeKey(name: string, url: string) {
  return `${name}||${url}`;
}

function pickAttr(extinfLine: string, attr: string) {
  const re = new RegExp(`${attr}="([^"]*)"`, "i");
  return extinfLine.match(re)?.[1]?.trim() || "";
}

function parseM3U(text: string): Channel[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const channels: Channel[] = [];

  let pendingName: string | null = null;
  let pendingLogo = "";
  let pendingGroup = "Otros";

  for (const line of lines) {
    if (!line) continue;

    if (line.startsWith("#EXTINF")) {
      const parts = line.split(",");
      pendingName = (parts.slice(1).join(",") || "Canal").trim();

      pendingLogo = pickAttr(line, "tvg-logo") || "";
      const g = pickAttr(line, "group-title");
      pendingGroup = g?.trim() ? g.trim() : "Otros";
      continue;
    }

    if (pendingName && !line.startsWith("#")) {
      channels.push({
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,
        name: pendingName,
        url: line,
        group: pendingGroup || "Otros",
        logo: pendingLogo || "",
      });
      pendingName = null;
      pendingLogo = "";
      pendingGroup = "Otros";
    }
  }

  return channels;
}

function safeJsonParse<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function qualityBadge(name: string) {
  const s = String(name || "").toLowerCase();
  if (s.includes("4k") || s.includes("uhd") || s.includes("2160")) return "4K";
  if (s.includes("fhd") || s.includes("1080") || s.includes("hd")) return "HD";
  return "";
}

// ===== Prefs helpers
function loadPlayerPrefs(): PlayerPrefs {
  const def: PlayerPrefs = { volume: 1, muted: true, level: -1, userInteracted: false };
  if (typeof window === "undefined") return def;

  const x = safeJsonParse<PlayerPrefs>(localStorage.getItem(LS_PLAYER));
  if (!x) return def;

  return {
    volume: typeof x.volume === "number" ? clamp(x.volume, 0, 1) : 1,
    muted: !!x.muted,
    level: typeof x.level === "number" ? x.level : -1,
    userInteracted: !!x.userInteracted,
  };
}

function loadProgressMap(): ProgressMap {
  if (typeof window === "undefined") return {};
  return safeJsonParse<ProgressMap>(localStorage.getItem(LS_PROGRESS)) || {};
}

export default function Page() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [selected, setSelected] = useState<Channel | null>(null);

  const [query, setQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("Todos");
  const [statusText, setStatusText] = useState("Cargando playlist...");

  const [recents, setRecents] = useState<RecentItem[]>([]);
  const [lastKey, setLastKey] = useState<string>("");

  // ✅ Favoritos
  const [favKeys, setFavKeys] = useState<Record<string, 1>>({});

  // ✅ Grid Netflix + SmartTV focus
  const [focusIndex, setFocusIndex] = useState(0);
  const [cols, setCols] = useState(4);

  // ✅ Reproductor PRO (calidad)
  const [levels, setLevels] = useState<{ id: number; label: string }[]>([]);
  const [level, setLevel] = useState<number>(-1); // -1 auto

  // ✅ prefs persistentes
  const prefsRef = useRef<PlayerPrefs>({
    volume: 1,
    muted: true,
    level: -1,
    userInteracted: false,
  });

  // ✅ progreso (resume)
  const progressRef = useRef<ProgressMap>({});

  // ✅ retry/failover
  const retryRef = useRef<{ tries: number; lastUrl: string }>({ tries: 0, lastUrl: "" });
  const switchLockRef = useRef(false);

  function savePlayerPrefs(p: Partial<PlayerPrefs>) {
    try {
      const cur = prefsRef.current || loadPlayerPrefs();
      const next: PlayerPrefs = { ...cur, ...p };
      prefsRef.current = next;
      localStorage.setItem(LS_PLAYER, JSON.stringify(next));
    } catch {}
  }

  function saveProgress(k: string, t: number) {
    try {
      const map = progressRef.current || {};
      map[k] = { t: Math.max(0, t), at: Date.now() };
      progressRef.current = map;
      localStorage.setItem(LS_PROGRESS, JSON.stringify(map));
    } catch {}
  }

  function applyPrefsToVideo() {
    const v = videoRef.current;
    if (!v) return;
    const p = prefsRef.current;
    try {
      v.volume = clamp(p.volume ?? 1, 0, 1);
    } catch {}
    try {
      v.muted = !!p.muted;
    } catch {}
  }

  // ✅ Derivados SIEMPRE antes de returns
  const groups = useMemo(() => {
    const set = new Set<string>();
    for (const c of channels) set.add((c.group || "Otros").trim() || "Otros");
    return ["Todos", "⭐ Favoritos", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [channels]);

  const filteredChannels = useMemo(() => {
    const q = query.trim().toLowerCase();

    return channels
      .filter((c) => {
        const k = makeKey(c.name, c.url);

        const okGroup =
          selectedGroup === "Todos"
            ? true
            : selectedGroup === "⭐ Favoritos"
            ? !!favKeys[k]
            : c.group === selectedGroup;

        const okQuery = !q ? true : c.name.toLowerCase().includes(q);
        return okGroup && okQuery;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [channels, query, selectedGroup, favKeys]);

  // ✅ proteger
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  function cleanupPlayer() {
    try {
      setLevels([]);
      setLevel(-1);

      const hls = hlsRef.current;
      if (hls) {
        try {
          hls.stopLoad();
        } catch {}
        try {
          hls.detachMedia();
        } catch {}
        try {
          hls.destroy();
        } catch {}
        hlsRef.current = null;
      }

      const video = videoRef.current;
      if (video) {
        try {
          video.pause();
        } catch {}
        try {
          video.removeAttribute("src");
          video.load();
        } catch {}
      }
    } catch {}
  }

  function applyLevelToHls(nextLevel: number) {
    const hls = hlsRef.current;
    if (!hls) return;
    try {
      hls.currentLevel = nextLevel; // -1 auto
    } catch {}
  }

  function buildLevelLabels(hls: Hls) {
    const lvls = hls.levels.map((l, idx) => {
      const label =
        (l.height ? `${l.height}p` : "") ||
        (l.bitrate ? `${Math.round(l.bitrate / 1000)} kbps` : "") ||
        `Nivel ${idx}`;
      return { id: idx, label };
    });

    setLevels([{ id: -1, label: "Auto" }, ...lvls]);

    const saved = prefsRef.current?.level ?? -1;
    setLevel(saved);
    try {
      hls.currentLevel = saved;
    } catch {}
  }

  function getSelectedIndexInFiltered() {
    if (!selected) return -1;
    const k = makeKey(selected.name, selected.url);
    return filteredChannels.findIndex((c) => makeKey(c.name, c.url) === k);
  }

  function playByChannel(c: Channel, opts?: { autoplay?: boolean }) {
    setSelected(c);
    const k = makeKey(c.name, c.url);
    setLastKey(k);
    pushRecent(c);

    // interacción
    savePlayerPrefs({ userInteracted: true });

    play(c.url, { autoplay: !!opts?.autoplay });
  }

  function playNext() {
    const idx = getSelectedIndexInFiltered();
    if (idx < 0) {
      const c = filteredChannels[focusIndex] || filteredChannels[0];
      if (c) playByChannel(c, { autoplay: true });
      return;
    }
    const next = filteredChannels[idx + 1] || filteredChannels[0];
    if (next) playByChannel(next, { autoplay: true });
  }

  function playPrev() {
    const idx = getSelectedIndexInFiltered();
    if (idx < 0) {
      const c = filteredChannels[focusIndex] || filteredChannels[0];
      if (c) playByChannel(c, { autoplay: true });
      return;
    }
    const prev = filteredChannels[idx - 1] || filteredChannels[filteredChannels.length - 1];
    if (prev) playByChannel(prev, { autoplay: true });
  }

  async function tryResumeForSelected() {
    const v = videoRef.current;
    if (!v || !selected) return;

    const k = makeKey(selected.name, selected.url);
    const map = progressRef.current || {};
    const saved = map[k];
    if (!saved) return;

    // si es casi 0, no hagas nada
    if (!saved.t || saved.t < 3) return;

    // espera metadata/duration
    let tries = 0;
    while (tries < 30) {
      const dur = Number(v.duration || 0);
      if (dur && isFinite(dur)) break;
      await new Promise((r) => setTimeout(r, 100));
      tries++;
    }

    const dur = Number(v.duration || 0);
    if (!dur || !isFinite(dur)) return;

    // si está muy cerca del final, no resumes
    const t = Math.min(saved.t, Math.max(0, dur - 12));
    if (t < 3) return;

    try {
      v.currentTime = t;
      setStatusText((s) => (s.includes("Reproduciendo") ? `${s} (resume)` : `${s} (resume)`));
    } catch {}
  }

  function scheduleFailover(reason: string) {
    // evita loops rápidos
    if (switchLockRef.current) return;
    switchLockRef.current = true;

    setStatusText(`⚠️ ${reason}. Probando de nuevo...`);

    // reintento corto primero
    setTimeout(() => {
      switchLockRef.current = false;
      // si todavía hay seleccionado, intenta recargar
      if (selected) {
        reloadStream(true);
      }
    }, 800);
  }

  function play(url: string, opts?: { autoplay?: boolean; isRetry?: boolean }) {
    const video = videoRef.current;
    if (!video) return;

    cleanupPlayer();

    applyPrefsToVideo();

    setStatusText(opts?.isRetry ? "Reintentando canal..." : "Cargando canal...");

    // reset retry si cambia URL
    if (retryRef.current.lastUrl !== url) {
      retryRef.current = { tries: 0, lastUrl: url };
    }

    // HLS nativo
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;

      const doPlay = () => {
        video
          .play()
          .then(async () => {
            setStatusText("Reproduciendo (HLS nativo).");
            await tryResumeForSelected(); // ✅ resume (#6)
          })
          .catch(() => setStatusText("Presiona play para iniciar."));
      };

      if (opts?.autoplay) doPlay();
      else setStatusText("Listo. Presiona play para iniciar.");

      return;
    }

    // hls.js
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
      });
      hlsRef.current = hls;

      hls.attachMedia(video);

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        try {
          hls.loadSource(url);
        } catch {
          setStatusText("No se pudo cargar la fuente.");
        }
      });

      hls.on(Hls.Events.MANIFEST_PARSED, async () => {
        try {
          buildLevelLabels(hls);
        } catch {}

        if (opts?.autoplay) {
          video
            .play()
            .then(async () => {
              setStatusText("Reproduciendo (hls.js).");
              await tryResumeForSelected(); // ✅ resume (#6)
            })
            .catch(() => setStatusText("Presiona play para iniciar."));
        } else {
          setStatusText("Listo. Presiona play para iniciar.");
        }
      });

      // ✅ UPDATE #7: reintentos + salto al siguiente canal si no se puede
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (!data) return;

        if (!data.fatal) {
          setStatusText(`Error: ${data.type} ${data.details}`);
          return;
        }

        // sube contador
        retryRef.current.tries += 1;
        const tries = retryRef.current.tries;

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          if (tries <= 2) {
            setStatusText(`Error de red. Reintentando... (${tries}/2)`);
            try {
              hls.startLoad();
              return;
            } catch {}
          }
          // después de 2, cambiar al siguiente
          setStatusText("❌ Stream caído. Cambiando al siguiente canal...");
          cleanupPlayer();
          setTimeout(() => playNext(), 500);
          return;
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          if (tries <= 2) {
            setStatusText(`Error de media. Recuperando... (${tries}/2)`);
            try {
              hls.recoverMediaError();
              return;
            } catch {}
          }
          setStatusText("❌ Error de reproducción. Cambiando al siguiente canal...");
          cleanupPlayer();
          setTimeout(() => playNext(), 500);
          return;
        }

        setStatusText(`Error fatal: ${data.type} ${data.details}`);
        cleanupPlayer();
        scheduleFailover("Error fatal");
      });

      return;
    }

    setStatusText("Tu navegador no soporta HLS.");
  }

  function reloadStream(fromFailover?: boolean) {
    if (!selected) return;

    const canAuto = !!prefsRef.current.userInteracted;
    play(selected.url, { autoplay: canAuto, isRetry: true });

    if (!fromFailover) {
      // reset contadores cuando el usuario lo hace manual
      retryRef.current = { tries: 0, lastUrl: selected.url };
    }
  }

  function toggleFullscreen() {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen();
        return;
      }
      const anyV = v as any;
      if (anyV.requestFullscreen) anyV.requestFullscreen();
      else if (anyV.webkitEnterFullscreen) anyV.webkitEnterFullscreen();
    } catch {}
  }

  function pushRecent(c: Channel) {
    try {
      const item: RecentItem = { name: c.name, url: c.url, group: c.group, logo: c.logo || "", at: Date.now() };
      const prev = safeJsonParse<RecentItem[]>(localStorage.getItem(LS_RECENTS)) || [];
      const next = [item, ...prev.filter((x) => makeKey(x.name, x.url) !== makeKey(c.name, c.url))].slice(0, 12);

      localStorage.setItem(LS_RECENTS, JSON.stringify(next));
      setRecents(next);

      const k = makeKey(c.name, c.url);
      localStorage.setItem(LS_LAST, k);
      setLastKey(k);
    } catch {}
  }

  function toggleFav(c: Channel) {
    try {
      const k = makeKey(c.name, c.url);
      const next = { ...(favKeys || {}) };
      if (next[k]) delete next[k];
      else next[k] = 1;
      setFavKeys(next);
      localStorage.setItem(LS_FAVS, JSON.stringify(next));
    } catch {}
  }

  // ✅ cargar recents, last, favs + prefs + progress
  useEffect(() => {
    try {
      setRecents(safeJsonParse<RecentItem[]>(localStorage.getItem(LS_RECENTS)) || []);
      setLastKey(localStorage.getItem(LS_LAST) || "");
      setFavKeys(safeJsonParse<Record<string, 1>>(localStorage.getItem(LS_FAVS)) || {});

      prefsRef.current = loadPlayerPrefs();
      progressRef.current = loadProgressMap();
    } catch {}
  }, []);

  // ✅ guardar volumen/mute y detectar interacción (play)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    applyPrefsToVideo();

    const onVol = () => {
      savePlayerPrefs({ volume: v.volume, muted: v.muted });
    };

    const onPlay = () => {
      savePlayerPrefs({ userInteracted: true });
    };

    v.addEventListener("volumechange", onVol);
    v.addEventListener("play", onPlay);

    return () => {
      v.removeEventListener("volumechange", onVol);
      v.removeEventListener("play", onPlay);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef.current]);

  // ✅ UPDATE #6: guardar progreso mientras reproduce
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    let lastSave = 0;

    const tick = () => {
      if (!selected) return;
      if (!isFinite(v.currentTime)) return;

      // guarda cada ~3s
      const now = Date.now();
      if (now - lastSave < 3000) return;
      lastSave = now;

      const k = makeKey(selected.name, selected.url);
      saveProgress(k, v.currentTime);
    };

    const onEnded = () => {
      if (!selected) return;
      // si terminó, resetea a 0 para que no reanude al final
      const k = makeKey(selected.name, selected.url);
      saveProgress(k, 0);
    };

    v.addEventListener("timeupdate", tick);
    v.addEventListener("ended", onEnded);

    return () => {
      v.removeEventListener("timeupdate", tick);
      v.removeEventListener("ended", onEnded);
    };
  }, [selected]);

  // ✅ cargar playlist global
  useEffect(() => {
    if (status !== "authenticated") return;

    (async () => {
      try {
        setStatusText("Cargando playlist...");
        const res = await fetch("/api/playlist/global", { method: "GET" });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setChannels([]);
          setStatusText(data?.error || `No se pudo cargar playlist. HTTP ${res.status}`);
          return;
        }

        const m3uText = String(data?.m3uText || "");
        const list = parseM3U(m3uText);

        setChannels(list);
        setSelected(null);
        setQuery("");
        setSelectedGroup("Todos");
        setStatusText(list.length ? `Listo: ${list.length} canales.` : "Playlist vacía.");

        setFocusIndex(0);
      } catch {
        setChannels([]);
        setStatusText("No se pudo cargar playlist (error de red).");
      }
    })();
  }, [status]);

  // ✅ auto-reproducir último canal (si existe) + autoplay si ya hubo interacción
  useEffect(() => {
    if (!channels.length) return;
    const k = lastKey || "";
    if (!k) return;

    const match = channels.find((c) => makeKey(c.name, c.url) === k);
    if (!match) return;

    setSelected(match);

    const canAuto = !!prefsRef.current.userInteracted;
    play(match.url, { autoplay: canAuto });

    try {
      pushRecent(match);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels]);

  // ✅ calcular columnas
  useEffect(() => {
    function calc() {
      const w = gridRef.current?.clientWidth || window.innerWidth;
      const nextCols = clamp(Math.floor(w / 220), 2, 7);
      setCols(nextCols);
    }
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  // ✅ Smart TV + ✅ UPDATE #8: teclas multimedia
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || tag === "select";
      if (typing) return;

      const total = filteredChannels.length;
      if (!total) return;

      // teclas multimedia
      if (e.key === "MediaTrackNext") {
        e.preventDefault();
        playNext();
        return;
      }
      if (e.key === "MediaTrackPrevious") {
        e.preventDefault();
        playPrev();
        return;
      }
      if (e.key === "MediaPlayPause") {
        e.preventDefault();
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) {
          savePlayerPrefs({ userInteracted: true });
          v.play().catch(() => {});
        } else {
          v.pause();
        }
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        setFocusIndex((i) => clamp(i + 1, 0, total - 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setFocusIndex((i) => clamp(i - 1, 0, total - 1));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIndex((i) => clamp(i + cols, 0, total - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIndex((i) => clamp(i - cols, 0, total - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const c = filteredChannels[focusIndex];
        if (!c) return;
        setSelected(c);
        savePlayerPrefs({ userInteracted: true });
        play(c.url, { autoplay: true });
        pushRecent(c);
        setLastKey(makeKey(c.name, c.url));
      } else if (e.key === "Escape" || e.key === "Backspace") {
        e.preventDefault();
        cleanupPlayer();
        setSelected(null);
        setStatusText("Listo.");
      }
    }

    window.addEventListener("keydown", onKey, { passive: false } as any);
    return () => window.removeEventListener("keydown", onKey as any);
  }, [filteredChannels, focusIndex, cols, selected]);

  // ✅ scroll automático al ítem enfocado
  useEffect(() => {
    const el = document.getElementById(`ch-${focusIndex}`);
    if (el) el.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [focusIndex]);

  // cleanup al salir
  useEffect(() => {
    return () => cleanupPlayer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ returns después de hooks
  if (status === "loading") return null;
  if (!session) return null;

  // ===== styles =====
  const text = "white";
  const muted = "rgba(255,255,255,0.75)";

  const borderWidth = 1;
  const borderStyle = "solid";
  const borderColor = "rgba(255,255,255,0.10)";
  const panelBg = "rgba(16,24,39,0.85)";
  const panel2Bg = "rgba(0,0,0,0.22)";

  const hoverRed = "rgba(239,68,68,0.95)";

  return (
    <div style={{ minHeight: "100vh", padding: 16, background: "#0b0f17", color: text, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <RightToolbar />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "520px 1fr", gap: 12 }}>
        {/* LEFT */}
        <div style={{ minWidth: 0 }}>
          <div style={{ borderRadius: 16, borderWidth, borderStyle, borderColor, background: panelBg, padding: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Canales</div>

            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setFocusIndex(0);
              }}
              placeholder="Buscar canal…"
              style={{
                width: "100%",
                marginTop: 8,
                padding: 10,
                borderRadius: 12,
                borderWidth,
                borderStyle,
                borderColor: "rgba(255,255,255,0.14)",
                background: "rgba(15,22,36,0.95)",
                color: text,
                outline: "none",
              }}
            />

            <select
              value={selectedGroup}
              onChange={(e) => {
                setSelectedGroup(e.target.value);
                setFocusIndex(0);
              }}
              style={{
                width: "100%",
                marginTop: 10,
                padding: 10,
                borderRadius: 12,
                borderWidth,
                borderStyle,
                borderColor: "rgba(255,255,255,0.14)",
                background: "rgba(15,22,36,0.95)",
                color: text,
                outline: "none",
                cursor: "pointer",
              }}
            >
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>

            {/* Recientes */}
            {recents.length ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: muted, fontWeight: 900, marginBottom: 6 }}>Recientes</div>
                <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6 }}>
                  {recents.map((r) => {
                    const k = makeKey(r.name, r.url);
                    const isFav = !!favKeys[k];
                    const badge = qualityBadge(r.name);

                    return (
                      <div
                        key={k}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          const ch: Channel = { id: k, name: r.name, url: r.url, group: r.group || "Otros", logo: r.logo || "" };
                          playByChannel(ch, { autoplay: true });
                        }}
                        style={{
                          minWidth: 220,
                          borderRadius: 16,
                          padding: 10,
                          background: "rgba(0,0,0,0.18)",
                          borderWidth,
                          borderStyle,
                          borderColor: "rgba(255,255,255,0.10)",
                          cursor: "pointer",
                          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                        }}
                        title={r.name}
                      >
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          {r.logo ? (
                            <img
                              src={r.logo}
                              alt=""
                              width={44}
                              height={44}
                              style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 12, background: "#0a0a0a" }}
                              onError={(e) => (((e.currentTarget as HTMLImageElement).style.display = "none"))}
                            />
                          ) : (
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#0a0a0a", display: "grid", placeItems: "center", fontWeight: 900 }}>
                              {r.name.trim().charAt(0).toUpperCase()}
                            </div>
                          )}

                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 900, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                            <div style={{ fontSize: 11, opacity: 0.7 }}>{r.group || "Otros"}</div>
                          </div>

                          {badge ? (
                            <div
                              style={{
                                padding: "4px 8px",
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 900,
                                background: badge === "4K" ? "rgba(34,197,94,0.25)" : "rgba(59,130,246,0.25)",
                                borderWidth,
                                borderStyle,
                                borderColor: "rgba(255,255,255,0.10)",
                              }}
                            >
                              {badge}
                            </div>
                          ) : null}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFav({ id: k, name: r.name, url: r.url, group: r.group || "Otros", logo: r.logo || "" });
                            }}
                            style={{
                              border: "none",
                              background: "transparent",
                              color: isFav ? "#fbbf24" : "rgba(255,255,255,0.6)",
                              cursor: "pointer",
                              fontSize: 18,
                              lineHeight: 1,
                              padding: 6,
                            }}
                            title={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
                          >
                            ★
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Grid */}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: muted, fontWeight: 900, marginBottom: 8 }}>
                {filteredChannels.length ? `Resultados: ${filteredChannels.length}` : "Sin resultados"}
              </div>

              <div ref={gridRef} style={{ maxHeight: "calc(100vh - 320px)", overflow: "auto", paddingRight: 6 }}>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 12 }}>
                  {filteredChannels.map((c, idx) => {
                    const k = makeKey(c.name, c.url);
                    const isLast = lastKey === k;
                    const isFav = !!favKeys[k];
                    const badge = qualityBadge(c.name);
                    const isFocused = idx === focusIndex;

                    return (
                      <div
                        id={`ch-${idx}`}
                        key={c.id}
                        role="button"
                        tabIndex={0}
                        onMouseEnter={() => setFocusIndex(idx)}
                        onFocus={() => setFocusIndex(idx)}
                        onClick={() => playByChannel(c, { autoplay: true })}
                        style={{
                          borderRadius: 18,
                          padding: 10,
                          background: "rgba(0,0,0,0.18)",
                          borderWidth: 2,
                          borderStyle,
                          borderColor: isFocused ? hoverRed : isLast ? "rgba(37,99,235,0.75)" : "rgba(255,255,255,0.10)",
                          cursor: "pointer",
                          boxShadow: isFocused ? "0 18px 55px rgba(0,0,0,0.55)" : "0 12px 35px rgba(0,0,0,0.35)",
                          transform: isFocused ? "scale(1.03)" : "scale(1)",
                          transition: "transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
                          outline: "none",
                        }}
                        title={c.name}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                            {c.logo ? (
                              <img
                                src={c.logo}
                                alt=""
                                width={48}
                                height={48}
                                style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 14, background: "#0a0a0a" }}
                                onError={(e) => (((e.currentTarget as HTMLImageElement).style.display = "none"))}
                              />
                            ) : (
                              <div style={{ width: 48, height: 48, borderRadius: 14, background: "#0a0a0a", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 18 }}>
                                {c.name.trim().charAt(0).toUpperCase()}
                              </div>
                            )}

                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontWeight: 900, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                              <div style={{ fontSize: 11, color: muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.group}</div>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {badge ? (
                              <div
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 999,
                                  fontSize: 11,
                                  fontWeight: 900,
                                  background: badge === "4K" ? "rgba(34,197,94,0.25)" : "rgba(59,130,246,0.25)",
                                  borderWidth,
                                  borderStyle,
                                  borderColor: "rgba(255,255,255,0.10)",
                                }}
                              >
                                {badge}
                              </div>
                            ) : null}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFav(c);
                              }}
                              style={{ border: "none", background: "transparent", color: isFav ? "#fbbf24" : "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 6 }}
                              title={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
                            >
                              ★
                            </button>
                          </div>
                        </div>

                        <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>{isFocused ? "ENTER para reproducir" : " "}</div>
                          {isLast ? <div style={{ fontSize: 12, opacity: 0.9 }}>▶</div> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, color: muted }}>
                <b>Estado:</b> {statusText}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ minWidth: 0 }}>
          <div style={{ borderRadius: 16, borderWidth, borderStyle, borderColor, background: panelBg, padding: 12 }}>
            <div style={{ fontWeight: 900 }}>Reproductor</div>

            {selected ? (
              <div style={{ marginTop: 10, padding: 12, borderRadius: 16, borderWidth, borderStyle, borderColor, background: panel2Bg }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  {selected.logo ? (
                    <img
                      src={selected.logo}
                      alt=""
                      width={64}
                      height={64}
                      style={{ width: 64, height: 64, objectFit: "contain", borderRadius: 16, background: "#0a0a0a" }}
                      onError={(e) => (((e.currentTarget as HTMLImageElement).style.display = "none"))}
                    />
                  ) : (
                    <div style={{ width: 64, height: 64, borderRadius: 18, background: "#0a0a0a", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 26 }}>
                      {selected.name.trim().charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.1 }}>{selected.name}</div>
                    <div style={{ fontSize: 12, color: muted }}>
                      Categoría: <b style={{ color: text }}>{selected.group}</b>
                    </div>
                    <div style={{ fontSize: 12, color: muted }}>Estado: {statusText}</div>
                  </div>

                  {/* ✅ UPDATE #8: controles next/prev */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={playPrev}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "none",
                        background: "rgba(255,255,255,0.10)",
                        color: "white",
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                      title="Anterior (MediaTrackPrevious)"
                    >
                      ⏮️ Anterior
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        savePlayerPrefs({ userInteracted: true });
                        play(selected.url, { autoplay: true });
                      }}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "none",
                        background: "#2563eb",
                        color: "white",
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                    >
                      ▶️ Reproducir
                    </button>

                    <button
                      type="button"
                      onClick={() => reloadStream(false)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        borderWidth,
                        borderStyle,
                        borderColor: "rgba(255,255,255,0.14)",
                        background: "rgba(0,0,0,0.20)",
                        color: text,
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                    >
                      🔄 Recargar
                    </button>

                    <button
                      type="button"
                      onClick={playNext}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "none",
                        background: "rgba(255,255,255,0.10)",
                        color: "white",
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                      title="Siguiente (MediaTrackNext)"
                    >
                      ⏭️ Siguiente
                    </button>

                    <button
                      type="button"
                      onClick={toggleFullscreen}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        borderWidth,
                        borderStyle,
                        borderColor: "rgba(255,255,255,0.14)",
                        background: "rgba(0,0,0,0.20)",
                        color: text,
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                    >
                      ⛶ Pantalla completa
                    </button>

                    {levels.length ? (
                      <select
                        value={level}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setLevel(v);
                          savePlayerPrefs({ level: v });
                          applyLevelToHls(v);
                        }}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 12,
                          borderWidth,
                          borderStyle,
                          borderColor: "rgba(255,255,255,0.14)",
                          background: "rgba(15,22,36,0.95)",
                          color: text,
                          cursor: "pointer",
                          fontWeight: 900,
                        }}
                        title="Calidad"
                      >
                        {levels.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.label}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 10, padding: 14, borderRadius: 16, borderWidth, borderStyle, borderColor, background: panel2Bg, color: muted }}>
                🔥 Modo Smart TV: usa <b>flechas</b> para moverte y <b>ENTER</b> para reproducir. (ESC/BACK para salir)
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <video
                ref={videoRef}
                controls
                playsInline
                muted
                style={{
                  width: "100%",
                  maxWidth: 1200,
                  background: "black",
                  borderRadius: 16,
                  borderWidth: 1,
                  borderStyle,
                  borderColor: "rgba(255,255,255,0.06)",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
