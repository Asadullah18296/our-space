import React, { useState, useEffect, useRef, useCallback } from "react";
import { Moon, Star, Heart, Image as ImageIcon, Music, ListChecks, LogOut, Plus, Trash2, Upload, Check, Play, X, Lock, Video as VideoIcon, NotebookPen, Send } from "lucide-react";
import { supabase } from "./supabase.js";

/*
  OUR SPACE — a private place for two people.

  SECURITY:
  Login is real now. Email + password are verified by Supabase on the server,
  not in this file. Only the PUBLIC project URL + publishable key live in the
  frontend (see src/supabase.js) — they grant nothing without a valid login,
  because Row Level Security protects every table and file.

  All shared data (daily plans, photos, songs) lives in Supabase, so both
  partners see the same thing from anywhere, and it syncs live.
*/

// Per-user accent themes. Role is decided once per account (see profile setup).
const DEFAULT_NAMES = { a: "Asadullah", b: "My Love" };

// Static romantic dark palette (shared by everyone)
const BASE = {
  night: "#15111f",
  nightDeep: "#0e0b16",
  surface: "#221a30",
  surface2: "#2c2240",
  text: "#f3ece1",
  muted: "#a99fbd",
  line: "#3a2f4f",
  gold: "#d8b072",
};

const THEMES = {
  login: { accent: "#e8a7ad", accent2: "#f0c3b4", glow: "rgba(232,167,173,0.45)", onAccent: "#1a1020" },
  a: { accent: "#e23744", accent2: "#ff7a85", glow: "rgba(226,55,68,0.45)", onAccent: "#ffffff" }, // man → red
  b: { accent: "#ec4899", accent2: "#f9a8d4", glow: "rgba(236,72,153,0.45)", onAccent: "#1a1020" }, // her → pink
};

// ---------- Helpers ----------
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const prettyToday = () =>
  new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

const getYouTubeId = (url) => {
  const m = String(url).match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
};

const isAudioSrc = (s) => /\.(mp3|wav|ogg|m4a|aac)(\?|$)/i.test(s) || String(s).startsWith("data:audio");

// TikTok video id from a full URL (e.g. tiktok.com/@user/video/123…)
const getTikTokId = (url) => {
  const m = String(url).match(/tiktok\.com\/(?:@[\w.-]+\/video|v|embed)\/(\d+)/);
  return m ? m[1] : null;
};
// Instagram post/reel shortcode (e.g. instagram.com/reel/ABC123/)
const getInstagramCode = (url) => {
  const m = String(url).match(/instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
};
// Classify a pasted video link into a kind we know how to play.
const classifyVideoLink = (url) => {
  if (getYouTubeId(url)) return "yt";
  if (getTikTokId(url)) return "tiktok";
  if (getInstagramCode(url)) return "instagram";
  return "link";
};

// Fetch title / author / thumbnail for a media link (CORS-friendly, no key needed).
const fetchLinkMeta = async (url) => {
  try {
    const r = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
    const j = await r.json();
    if (j && !j.error) {
      return { title: j.title || "", author: j.author_name || "", thumb: j.thumbnail_url || "" };
    }
  } catch {}
  return null;
};

const themeVars = (t) => ({
  "--accent": t.accent,
  "--accent2": t.accent2,
  "--glow": t.glow,
  "--on-accent": t.onAccent,
  "--surface": BASE.surface,
  "--surface2": BASE.surface2,
  "--text": BASE.text,
  "--muted": BASE.muted,
  "--line": BASE.line,
  "--gold": BASE.gold,
  "--night": BASE.night,
  "--night-deep": BASE.nightDeep,
});

// ---------- Global styles (keyframes, hover/focus, reduced-motion) ----------
function GlobalStyles() {
  return (
    <style>{`
      * { box-sizing: border-box; }
      .us-root { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--text); overflow-x: hidden; }
      .us-script { font-family: "Great Vibes", cursive; }
      .us-serif { font-family: "Cormorant Garamond", Georgia, serif; }

      @keyframes us-fade-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes us-fade-in { from { opacity: 0; } to { opacity: 1; } }
      @keyframes us-pop { 0% { opacity: 0; transform: scale(.9); } 60% { transform: scale(1.03); } 100% { opacity: 1; transform: scale(1); } }
      @keyframes us-float { 0% { transform: translateY(0) rotate(0deg); opacity: 0; } 10% { opacity: .5; } 90% { opacity: .5; } 100% { transform: translateY(-120vh) rotate(40deg); opacity: 0; } }
      @keyframes us-twinkle { 0%, 100% { opacity: .25; transform: scale(.85); } 50% { opacity: 1; transform: scale(1.1); } }
      @keyframes us-glow-pulse { 0%, 100% { text-shadow: 0 0 12px var(--glow); } 50% { text-shadow: 0 0 26px var(--glow); } }
      @keyframes us-spin { to { transform: rotate(360deg); } }

      .us-enter { animation: us-fade-up .5s cubic-bezier(.2,.7,.3,1) both; }
      .us-enter-pop { animation: us-pop .45s cubic-bezier(.2,.7,.3,1) both; }

      .us-card { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; padding: 22px;
        transition: transform .25s cubic-bezier(.2,.7,.3,1), box-shadow .25s, border-color .25s; }
      .us-card:hover { transform: translateY(-3px); box-shadow: 0 16px 40px rgba(0,0,0,.45); border-color: var(--accent); }

      .us-btn { font-family: inherit; cursor: pointer; border: none; display: inline-flex; align-items: center; justify-content: center;
        gap: 8px; border-radius: 12px; font-size: 15px; font-weight: 600; transition: transform .12s ease, box-shadow .2s, filter .2s, background .2s; }
      .us-btn:active { transform: scale(.96); }
      .us-btn:disabled { cursor: not-allowed; opacity: .65; }
      .us-btn-primary { background: linear-gradient(135deg, var(--accent), var(--accent2)); color: var(--on-accent);
        box-shadow: 0 6px 20px var(--glow); }
      .us-btn-primary:hover:not(:disabled) { filter: brightness(1.06); box-shadow: 0 10px 28px var(--glow); }
      .us-btn-ghost { background: transparent; color: var(--muted); border: 1px solid var(--line); }
      .us-btn-ghost:hover { color: var(--text); border-color: var(--accent); background: rgba(255,255,255,.03); }

      .us-icon-btn { background: none; border: none; color: var(--muted); cursor: pointer; display: inline-flex; padding: 6px;
        border-radius: 9px; transition: color .2s, background .2s, transform .12s; }
      .us-icon-btn:hover { color: var(--accent2); background: rgba(255,255,255,.05); }
      .us-icon-btn:active { transform: scale(.9); }

      .us-input { width: 100%; padding: 12px 14px; border-radius: 11px; border: 1px solid var(--line);
        background: var(--night-deep); color: var(--text); font-size: 16px; font-family: inherit;
        transition: border-color .2s, box-shadow .2s; }
      .us-input::placeholder { color: var(--muted); }
      .us-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--glow); }

      .us-tab { position: relative; display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px;
        border-radius: 12px; border: none; cursor: pointer; font-size: 14px; font-weight: 600; font-family: inherit;
        background: var(--surface); color: var(--muted); transition: color .2s, background .2s, transform .12s; }
      .us-tab:hover { color: var(--text); }
      .us-tab:active { transform: scale(.96); }
      .us-tab.active { background: linear-gradient(135deg, var(--accent), var(--accent2)); color: var(--on-accent);
        box-shadow: 0 6px 18px var(--glow); }

      .us-check { width: 22px; height: 22px; border-radius: 7px; border: 2px solid var(--line); background: var(--night-deep);
        display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; cursor: pointer;
        transition: border-color .2s, background .2s, transform .12s; color: var(--on-accent); }
      .us-check:hover { border-color: var(--accent); }
      .us-check.on { background: linear-gradient(135deg, var(--accent), var(--accent2)); border-color: transparent; }

      .us-row { transition: background .2s; border-radius: 10px; }
      .us-row:hover { background: rgba(255,255,255,.03); }

      .us-photo { transition: transform .3s cubic-bezier(.2,.7,.3,1), box-shadow .3s; }
      .us-photo:hover { transform: rotate(0deg) scale(1.03) !important; box-shadow: 0 18px 44px rgba(0,0,0,.55); z-index: 2; }

      .us-link { color: var(--accent2); text-decoration: none; transition: color .2s; }
      .us-link:hover { color: var(--accent); text-decoration: underline; }

      .us-spin { animation: us-spin .8s linear infinite; }

      audio { filter: saturate(.9); }

      @media (prefers-reduced-motion: reduce) {
        .us-enter, .us-enter-pop { animation: none !important; }
        .us-card:hover, .us-photo:hover, .us-btn:active, .us-tab:active, .us-icon-btn:active { transform: none !important; }
        .us-float-layer { display: none !important; }
        .us-glow, .us-spin { animation: none !important; }
      }
    `}</style>
  );
}

// ---------- Floating hearts / sparkles background ----------
function FloatingLayer() {
  const items = useRef(
    Array.from({ length: 14 }).map((_, i) => ({
      id: i,
      left: Math.round(Math.random() * 100),
      size: 10 + Math.round(Math.random() * 18),
      delay: Math.round(Math.random() * 12),
      dur: 14 + Math.round(Math.random() * 12),
      heart: Math.random() > 0.45,
    }))
  ).current;

  return (
    <div className="us-float-layer" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      {items.map((it) => (
        <span
          key={it.id}
          style={{
            position: "absolute", bottom: -30, left: `${it.left}%`,
            color: it.heart ? "var(--accent)" : "var(--gold)",
            animation: `us-float ${it.dur}s linear ${it.delay}s infinite`,
          }}
        >
          {it.heart ? <Heart size={it.size} fill="currentColor" /> : <Star size={it.size} fill="currentColor" />}
        </span>
      ))}
    </div>
  );
}

// ---------- Small full-screen splash while we check the session ----------
function Splash() {
  return (
    <div className="us-root" style={{ ...themeVars(THEMES.login), minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: `radial-gradient(130% 90% at 50% -10%, ${BASE.surface} 0%, ${BASE.night} 50%, ${BASE.nightDeep} 100%)` }}>
      <GlobalStyles />
      <div style={{ textAlign: "center", color: "var(--muted)" }}>
        <Heart size={34} fill="var(--accent)" color="var(--accent)" style={{ animation: "us-twinkle 1.6s ease-in-out infinite" }} />
        <p className="us-serif" style={{ fontStyle: "italic", marginTop: 12 }}>Opening Our Space…</p>
      </div>
    </div>
  );
}

export default function App() {
  const [booting, setBooting] = useState(true);       // checking the saved session
  const [session, setSession] = useState(null);       // supabase session (or null)
  const [profiles, setProfiles] = useState([]);       // both partner profiles
  const [tab, setTab] = useState("routine");
  const [notice, setNotice] = useState("");

  // shared data
  const [plans, setPlans] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [songs, setSongs] = useState([]);
  const [videos, setVideos] = useState([]);
  const [notes, setNotes] = useState([]);

  const flash = useCallback((msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3500);
  }, []);

  // ---- Auth bootstrap + live session changes ----
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session ?? null);
      setBooting(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  const myId = session?.user?.id || null;
  const myProfile = profiles.find((p) => p.id === myId) || null;
  const me = myProfile?.role || null;            // "a" | "b" | null (needs setup)
  const partner = me === "a" ? "b" : me === "b" ? "a" : null;
  const idToName = Object.fromEntries(profiles.map((p) => [p.id, p.name || "Someone"]));
  const names = {
    a: profiles.find((p) => p.role === "a")?.name || DEFAULT_NAMES.a,
    b: profiles.find((p) => p.role === "b")?.name || DEFAULT_NAMES.b,
  };
  const myName = me ? names[me] : "";
  const partnerName = partner ? names[partner] : "";
  const theme = me ? THEMES[me] : THEMES.login;

  // ---- Profiles (needed for names + role) ----
  const loadProfiles = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("id, name, role");
    setProfiles(data || []);
  }, []);

  // ---- Data loaders ----
  const loadPlans = useCallback(async () => {
    const today = todayStr();
    // tidy up: yesterday's plans don't belong to today
    await supabase.from("plans").delete().lt("day", today);
    const { data } = await supabase.from("plans").select("*").eq("day", today).order("created_at", { ascending: true });
    setPlans(data || []);
  }, []);

  const loadPhotos = useCallback(async () => {
    const today = todayStr();
    // photos clear each new day — remove older files + rows first
    const { data: old } = await supabase.from("photos").select("id, path").lt("day", today);
    if (old && old.length) {
      await supabase.storage.from("photos").remove(old.map((o) => o.path));
      await supabase.from("photos").delete().lt("day", today);
    }
    const { data } = await supabase.from("photos").select("*").eq("day", today).order("created_at", { ascending: false });
    const withUrls = await Promise.all(
      (data || []).map(async (p) => {
        const { data: signed } = await supabase.storage.from("photos").createSignedUrl(p.path, 3600);
        return { ...p, url: signed?.signedUrl || null };
      })
    );
    setPhotos(withUrls);
  }, []);

  const loadSongs = useCallback(async () => {
    const { data } = await supabase.from("songs").select("*").order("created_at", { ascending: false });
    setSongs(data || []);
  }, []);

  const loadVideos = useCallback(async () => {
    // videos disappear after 2 days — remove older files + rows first
    const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const { data: old } = await supabase.from("videos").select("id, path").lt("created_at", cutoff);
    if (old && old.length) {
      const paths = old.map((o) => o.path).filter(Boolean);
      if (paths.length) await supabase.storage.from("videos").remove(paths);
      await supabase.from("videos").delete().lt("created_at", cutoff);
    }
    const { data } = await supabase.from("videos").select("*").order("created_at", { ascending: false });
    setVideos(data || []);
  }, []);

  const loadNotes = useCallback(async () => {
    const { data } = await supabase.from("notes").select("*").order("created_at", { ascending: false });
    setNotes(data || []);
  }, []);

  // ---- Load everything once logged in, and subscribe to live changes ----
  useEffect(() => {
    if (!session) { setProfiles([]); setPlans([]); setPhotos([]); setSongs([]); setVideos([]); setNotes([]); return; }
    loadProfiles();
    loadPlans();
    loadPhotos();
    loadSongs();
    loadVideos();
    loadNotes();

    const ch = supabase
      .channel("our-space")
      .on("postgres_changes", { event: "*", schema: "public", table: "plans" }, loadPlans)
      .on("postgres_changes", { event: "*", schema: "public", table: "photos" }, loadPhotos)
      .on("postgres_changes", { event: "*", schema: "public", table: "songs" }, loadSongs)
      .on("postgres_changes", { event: "*", schema: "public", table: "videos" }, loadVideos)
      .on("postgres_changes", { event: "*", schema: "public", table: "notes" }, loadNotes)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, loadProfiles)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session, loadProfiles, loadPlans, loadPhotos, loadSongs, loadVideos, loadNotes]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setTab("routine");
  };

  // ===================== SPLASH / LOGIN / SETUP =====================
  if (booting) return <Splash />;
  if (!session) return <Login flash={flash} />;
  // logged in but the account hasn't picked who they are yet
  if (!me) {
    return (
      <ProfileSetup
        session={session}
        takenRoles={profiles.filter((p) => p.id !== myId).map((p) => p.role).filter(Boolean)}
        onDone={loadProfiles}
        onSignOut={signOut}
      />
    );
  }

  // ===================== APP =====================
  return (
    <div className="us-root" style={{ ...themeVars(theme), minHeight: "100vh",
      background: `linear-gradient(180deg, ${BASE.night} 0%, ${BASE.nightDeep} 100%)` }}>
      <GlobalStyles />

      {/* Header */}
      <header style={{ padding: "18px 22px", borderBottom: `1px solid var(--line)`, display: "flex",
        alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
        background: "rgba(0,0,0,.15)", backdropFilter: "blur(6px)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ display: "inline-flex", width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center",
            background: "linear-gradient(135deg, var(--accent), var(--accent2))", boxShadow: "0 6px 18px var(--glow)" }}>
            <Heart size={20} fill="var(--on-accent)" color="var(--on-accent)" />
          </span>
          <span className="us-script" style={{ fontSize: 30, lineHeight: 1, color: "var(--text)" }}>Our Space</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ color: "var(--muted)", fontSize: 14 }}>
            Hello, <span style={{ color: "var(--accent2)", fontWeight: 600 }}>{myName}</span>
          </span>
          <button className="us-btn us-btn-ghost" onClick={signOut} style={{ padding: "8px 12px", fontSize: 13 }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav style={{ display: "flex", gap: 8, padding: "16px 22px 0", flexWrap: "wrap" }}>
        {[
          { id: "routine", label: "Daily Plan", icon: ListChecks },
          { id: "images", label: "Photos", icon: ImageIcon },
          { id: "videos", label: "Videos", icon: VideoIcon },
          { id: "music", label: "Music", icon: Music },
          { id: "notes", label: "Notes", icon: NotebookPen },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} className={`us-tab${tab === id ? " active" : ""}`} onClick={() => setTab(id)}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </nav>

      {notice && (
        <div className="us-enter" style={{ margin: "14px 22px 0", padding: "11px 15px", background: "var(--surface2)",
          borderRadius: 12, color: "var(--accent2)", fontSize: 14, border: "1px solid var(--line)" }} role="status" aria-live="polite">
          {notice}
        </div>
      )}

      <main style={{ padding: 22, maxWidth: 1100, margin: "0 auto" }}>
        {tab === "routine" && (
          <Routine
            key="routine"
            me={me} partner={partner} myName={myName} partnerName={partnerName}
            myId={myId} plans={plans} flash={flash} reload={loadPlans}
          />
        )}
        {tab === "images" && (
          <Images key="images" photos={photos} myId={myId} idToName={idToName} flash={flash} reload={loadPhotos} />
        )}
        {tab === "videos" && (
          <VideosSection key="videos" videos={videos} myId={myId} myName={myName} flash={flash} reload={loadVideos} />
        )}
        {tab === "music" && (
          <MusicSection key="music" songs={songs} myId={myId} myName={myName} flash={flash} reload={loadSongs} />
        )}
        {tab === "notes" && (
          <Notes key="notes" notes={notes} myId={myId} idToName={idToName} flash={flash} reload={loadNotes} />
        )}
      </main>
    </div>
  );
}

// ---------- Login ----------
function Login({ flash }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const mail = email.trim();
    if (!mail || !password) { setError("Please enter your email and password."); return; }
    setBusy(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: mail, password });
    setBusy(false);
    if (error) setError("That email or password isn't right.");
    // success → onAuthStateChange flips the app into the logged-in view
  };

  return (
    <div className="us-root" style={{ ...themeVars(THEMES.login), position: "relative", minHeight: "100vh", overflow: "hidden",
      background: `radial-gradient(130% 90% at 50% -10%, ${BASE.surface} 0%, ${BASE.night} 50%, ${BASE.nightDeep} 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <GlobalStyles />
      <FloatingLayer />
      <div className="us-enter" style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 400, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 14, color: "var(--gold)" }}>
          <Moon size={22} style={{ animation: "us-twinkle 4s ease-in-out infinite" }} />
          <Star size={15} style={{ marginTop: 4, animation: "us-twinkle 3s ease-in-out .5s infinite" }} />
          <Heart size={18} fill="var(--accent)" color="var(--accent)" style={{ animation: "us-twinkle 3.5s ease-in-out 1s infinite" }} />
        </div>
        <h1 className="us-script us-glow" style={{ fontSize: 64, margin: "0 0 2px", lineHeight: 1, color: "var(--text)",
          animation: "us-glow-pulse 4s ease-in-out infinite" }}>
          Our Space
        </h1>
        <p className="us-serif" style={{ color: "var(--muted)", margin: "0 0 30px", fontStyle: "italic", fontSize: 19 }}>
          A little place, just for the two of us.
        </p>

        <div className="us-card us-enter-pop" style={{ textAlign: "left", animationDelay: ".12s" }}>
          <label className="us-serif" style={{ fontSize: 16, color: "var(--muted)", fontWeight: 600 }}>Email</label>
          <input
            className="us-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder=""
            autoFocus
            style={{ marginTop: 8, marginBottom: 14 }}
          />
          <label className="us-serif" style={{ fontSize: 16, color: "var(--muted)", fontWeight: 600 }}>Password</label>
          <input
            className="us-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder=""
            style={{ marginTop: 8 }}
          />
          {error && (
            <p role="alert" style={{ color: "var(--accent2)", fontSize: 13, marginTop: 10, marginBottom: 0 }}>{error}</p>
          )}
          <button className="us-btn us-btn-primary" onClick={submit} disabled={busy} style={{ width: "100%", marginTop: 16, padding: "13px" }}>
            {busy ? <Heart size={16} className="us-spin" /> : <><Lock size={15} /> Enter</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- First-time profile setup (pick who you are) ----------
function ProfileSetup({ session, takenRoles, onDone, onSignOut }) {
  const [role, setRole] = useState(null);    // "a" | "b"
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const options = [
    { id: "a", label: "Asadullah", sub: "Red", t: THEMES.a },
    { id: "b", label: "My Love", sub: "Pink", t: THEMES.b },
  ];

  const save = async () => {
    if (!role) { setError("Choose which one is you."); return; }
    setBusy(true); setError("");
    const finalName = name.trim() || (role === "a" ? DEFAULT_NAMES.a : DEFAULT_NAMES.b);
    // upsert so it works even if no profile row exists yet (e.g. account
    // created before the trigger). Needs the profiles insert/update RLS policy.
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: session.user.id, role, name: finalName }, { onConflict: "id" });
    setBusy(false);
    if (error) { setError(error.message || "Couldn't save — please try again."); return; }
    await onDone();
  };

  return (
    <div className="us-root" style={{ ...themeVars(THEMES.login), minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      background: `radial-gradient(130% 90% at 50% -10%, ${BASE.surface} 0%, ${BASE.night} 50%, ${BASE.nightDeep} 100%)` }}>
      <GlobalStyles />
      <div className="us-enter" style={{ width: "100%", maxWidth: 440 }}>
        <h1 className="us-script" style={{ fontSize: 44, margin: "0 0 4px", textAlign: "center", color: "var(--text)" }}>Welcome</h1>
        <p className="us-serif" style={{ color: "var(--muted)", textAlign: "center", margin: "0 0 22px", fontStyle: "italic", fontSize: 18 }}>
          Just once — tell me who you are.
        </p>
        <div className="us-card" style={{ textAlign: "left" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {options.map((o) => {
              const taken = takenRoles.includes(o.id);
              const selected = role === o.id;
              return (
                <button key={o.id} disabled={taken} onClick={() => setRole(o.id)}
                  style={{ cursor: taken ? "not-allowed" : "pointer", textAlign: "center", padding: "18px 10px", borderRadius: 14,
                    background: selected ? `linear-gradient(135deg, ${o.t.accent}, ${o.t.accent2})` : "var(--night-deep)",
                    border: `1px solid ${selected ? "transparent" : "var(--line)"}`, color: selected ? o.t.onAccent : "var(--text)",
                    opacity: taken ? 0.4 : 1, transition: "all .2s", fontFamily: "inherit" }}>
                  <Heart size={22} fill="currentColor" />
                  <div style={{ fontWeight: 700, marginTop: 8, fontSize: 16 }}>{o.label}</div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>{taken ? "Taken" : o.sub}</div>
                </button>
              );
            })}
          </div>

          <label className="us-serif" style={{ fontSize: 15, color: "var(--muted)", fontWeight: 600, display: "block", marginTop: 18 }}>
            Your name (optional)
          </label>
          <input className="us-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="How should it greet you?" style={{ marginTop: 8 }} />

          {error && <p role="alert" style={{ color: "var(--accent2)", fontSize: 13, marginTop: 10, marginBottom: 0 }}>{error}</p>}

          <button className="us-btn us-btn-primary" onClick={save} disabled={busy} style={{ width: "100%", marginTop: 16, padding: "13px" }}>
            {busy ? <Heart size={16} className="us-spin" /> : <><Check size={16} /> That's me</>}
          </button>
          <button className="us-btn us-btn-ghost" onClick={onSignOut} style={{ width: "100%", marginTop: 10, padding: "10px" }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Daily Plan ----------
function Routine({ me, partner, myName, partnerName, myId, plans, flash, reload }) {
  const [draft, setDraft] = useState("");
  const forMe = plans.filter((p) => p.for_role === me);
  const forPartner = plans.filter((p) => p.for_role === partner);

  const addForPartner = async () => {
    const t = draft.trim();
    if (!t || forPartner.length >= 4) return;
    setDraft("");
    const { error } = await supabase.from("plans").insert({ day: todayStr(), for_role: partner, text: t, author: myId });
    if (error) flash("Couldn't add that — try again.");
    await reload();
  };
  const removeForPartner = async (id) => {
    const { error } = await supabase.from("plans").delete().eq("id", id);
    if (error) flash("Couldn't remove that — try again.");
    await reload();
  };
  const toggleMine = async (row) => {
    const { error } = await supabase.from("plans").update({ done: !row.done }).eq("id", row.id);
    if (error) flash("Couldn't update that — try again.");
    await reload();
  };

  return (
    <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))" }}>
      {/* Planned for me */}
      <section className="us-card us-enter">
        <h2 className="us-serif" style={{ margin: "0 0 2px", fontSize: 26, fontWeight: 600, color: "var(--accent2)" }}>Planned for you</h2>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 16px" }}>From {partnerName}, with love</p>
        {forMe.length === 0 && (
          <p className="us-serif" style={{ color: "var(--muted)", fontStyle: "italic", fontSize: 17 }}>
            Nothing yet. {partnerName} hasn't written you a plan.
          </p>
        )}
        {forMe.map((x, i) => (
          <div key={x.id} className="us-row us-enter" style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 8px",
            borderBottom: `1px solid var(--line)`, cursor: "pointer", animationDelay: `${i * 0.05}s` }} onClick={() => toggleMine(x)}>
            <span className={`us-check${x.done ? " on" : ""}`}>{x.done && <Check size={14} strokeWidth={3} />}</span>
            <span style={{ fontSize: 16, textDecoration: x.done ? "line-through" : "none", color: x.done ? "var(--muted)" : "var(--text)",
              transition: "color .2s" }}>{x.text}</span>
          </div>
        ))}
      </section>

      {/* I plan for partner */}
      <section className="us-card us-enter" style={{ animationDelay: ".08s" }}>
        <h2 className="us-serif" style={{ margin: "0 0 2px", fontSize: 26, fontWeight: 600, color: "var(--gold)" }}>You plan for {partnerName}</h2>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 16px" }}>Up to 4 things ({forPartner.length}/4)</p>
        {forPartner.map((x, i) => (
          <div key={x.id} className="us-row us-enter" style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 10, padding: "11px 8px", borderBottom: `1px solid var(--line)`, animationDelay: `${i * 0.05}s` }}>
            <span style={{ fontSize: 16, color: x.done ? "var(--muted)" : "var(--text)", textDecoration: x.done ? "line-through" : "none" }}>{x.text}</span>
            <button className="us-icon-btn" onClick={() => removeForPartner(x.id)} aria-label="Remove"><Trash2 size={16} /></button>
          </div>
        ))}
        {forPartner.length < 4 && (
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <input
              className="us-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addForPartner()}
              placeholder={`Something for ${partnerName}…`}
            />
            <button className="us-btn us-btn-primary" onClick={addForPartner} style={{ padding: "0 16px" }} aria-label="Add"><Plus size={18} /></button>
          </div>
        )}
      </section>
    </div>
  );
}

// ---------- Photos ----------
function Images({ photos, myId, idToName, flash, reload }) {
  const [viewer, setViewer] = useState(null);   // image opened full-screen
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      flash("Image is larger than 20 MB — please pick a smaller one.");
      return;
    }
    setUploading(true);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${todayStr()}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("photos").upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) { setUploading(false); flash("Upload failed — please try again."); return; }
    const { error } = await supabase.from("photos").insert({ day: todayStr(), path, caption: file.name, author: myId });
    setUploading(false);
    if (error) { flash("Saved the file but couldn't list it — try again."); return; }
    await reload();
  };

  const remove = async (img) => {
    setViewer((v) => (v && v.id === img.id ? null : v));
    await supabase.storage.from("photos").remove([img.path]);
    const { error } = await supabase.from("photos").delete().eq("id", img.id);
    if (error) flash("Couldn't remove that — try again.");
    await reload();
  };

  // Close the full-screen viewer with the Escape key.
  useEffect(() => {
    if (!viewer) return;
    const onKey = (e) => e.key === "Escape" && setViewer(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewer]);

  return (
    <div className="us-enter">
      {/* Daily banner */}
      <div className="us-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        flexWrap: "wrap", marginBottom: 20, background: "linear-gradient(135deg, var(--surface), var(--surface2))",
        position: "relative", overflow: "hidden" }}>
        <span aria-hidden style={{ position: "absolute", right: -40, top: -40, width: 160, height: 160, borderRadius: "50%",
          background: "radial-gradient(circle, var(--glow), transparent 70%)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <span style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(135deg, var(--accent), var(--accent2))", boxShadow: "0 8px 22px var(--glow)" }}>
            <ImageIcon size={24} color="var(--on-accent)" />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="us-serif" style={{ fontSize: 25, fontWeight: 600, color: "var(--accent2)" }}>Today's photos</div>
            <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 2 }}>
              {prettyToday()} · {photos.length} {photos.length === 1 ? "memory" : "memories"} · clears each new day
            </div>
          </div>
        </div>
        <label className="us-btn us-btn-primary" style={{ padding: "12px 20px", position: "relative", opacity: uploading ? 0.7 : 1 }}>
          {uploading ? <Heart size={16} className="us-spin" /> : <Upload size={16} />} {uploading ? "Uploading…" : "Add photo"}
          <input type="file" accept="image/*" onChange={handleFile} disabled={uploading} style={{ display: "none" }} />
        </label>
      </div>

      {photos.length === 0 ? (
        <div className="us-card" style={{ textAlign: "center", padding: "52px 22px" }}>
          <span style={{ width: 72, height: 72, borderRadius: 20, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(135deg, var(--accent), var(--accent2))", boxShadow: "0 12px 30px var(--glow)",
            animation: "us-twinkle 4s ease-in-out infinite" }}>
            <ImageIcon size={32} color="var(--on-accent)" />
          </span>
          <p className="us-serif" style={{ color: "var(--text)", fontSize: 22, margin: "18px 0 4px" }}>No photos today yet</p>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0, maxWidth: 360, marginInline: "auto", lineHeight: 1.6 }}>
            Share a moment from your day — a little memory, just for the two of you. It starts fresh tomorrow.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fill, minmax(min(160px, 100%), 1fr))" }}>
          {photos.map((img, i) => (
            <div key={img.id} className="us-photo us-enter-pop" onClick={() => setViewer(img)}
              style={{ position: "relative", background: "#f3ece1", padding: 11, borderRadius: 10, cursor: "zoom-in",
                boxShadow: "0 10px 28px rgba(0,0,0,.45)", transform: `rotate(${i % 2 ? 1.4 : -1.4}deg)`, animationDelay: `${i * 0.05}s` }}>
              <div style={{ position: "relative", borderRadius: 5, overflow: "hidden" }}>
                <img src={img.url} alt={img.caption || "Shared photo"} loading="lazy"
                  style={{ width: "100%", height: 170, objectFit: "cover", display: "block", background: "#ded3c4" }} />
                <button onClick={(e) => { e.stopPropagation(); remove(img); }} aria-label="Delete photo"
                  style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,.55)", border: "none",
                    color: "#fff", cursor: "pointer", padding: 6, borderRadius: 8, display: "inline-flex",
                    backdropFilter: "blur(4px)" }}>
                  <Trash2 size={15} />
                </button>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 9 }}>
                <span className="us-serif" style={{ color: "#5a4a3a", fontSize: 15 }}>by {idToName[img.author] || "Someone"}</span>
                <Heart size={13} fill="var(--accent)" color="var(--accent)" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full-screen viewer */}
      {viewer && (
        <div onClick={() => setViewer(null)} style={{ position: "fixed", inset: 0, zIndex: 50, padding: 20,
          background: "rgba(8,5,14,.86)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center",
          animation: "us-fade-in .25s ease both" }}>
          <div className="us-enter-pop" onClick={(e) => e.stopPropagation()} style={{ position: "relative", width: "100%", maxWidth: "min(640px, 100%)" }}>
            <div style={{ background: "#f3ece1", padding: 14, borderRadius: 14, boxShadow: "0 30px 80px rgba(0,0,0,.6)" }}>
              <img src={viewer.url} alt={viewer.caption || "Shared photo"}
                style={{ width: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 8, display: "block", background: "#000" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
                <span className="us-serif" style={{ color: "#5a4a3a", fontSize: 18 }}>by {idToName[viewer.author] || "Someone"}</span>
                <Heart size={16} fill="var(--accent)" color="var(--accent)" />
              </div>
            </div>
            <button onClick={() => setViewer(null)} aria-label="Close"
              style={{ position: "absolute", top: -16, right: -16, background: "var(--surface2)", border: "1px solid var(--line)",
                color: "var(--text)", cursor: "pointer", borderRadius: "50%", padding: 9, display: "inline-flex",
                boxShadow: "0 6px 18px rgba(0,0,0,.5)" }}>
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// A full-width "now playing" panel, shown when a song is picked.
function NowPlaying({ row, onClose }) {
  const [audioUrl, setAudioUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    if (row.kind === "audio") {
      setLoading(true);
      supabase.storage.from("music").createSignedUrl(row.path, 3600)
        .then(({ data }) => { if (alive) setAudioUrl(data?.signedUrl || null); })
        .finally(() => { if (alive) setLoading(false); });
    }
    return () => { alive = false; };
  }, [row]);

  // Escape closes the player.
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="us-card us-enter-pop" style={{ position: "sticky", top: 78, zIndex: 6,
      background: "linear-gradient(135deg, var(--surface), var(--surface2))", boxShadow: "0 14px 44px rgba(0,0,0,.55)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {row.thumb
          ? <img src={row.thumb} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />
          : <span style={{ width: 56, height: 56, borderRadius: 12, flexShrink: 0, background: "linear-gradient(135deg, var(--accent), var(--accent2))", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Music size={24} color="var(--on-accent)" /></span>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--accent2)", fontWeight: 700 }}>Now playing</div>
          <div style={{ fontSize: 17, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.title}</div>
          {row.author && <div style={{ color: "var(--muted)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.author}</div>}
        </div>
        <button className="us-icon-btn" onClick={onClose} aria-label="Close player"><X size={20} /></button>
      </div>

      <div style={{ marginTop: 14 }}>
        {row.kind === "yt" ? (
          <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 12, overflow: "hidden" }}>
            <iframe
              title={row.title}
              src={`https://www.youtube.com/embed/${row.yt}?autoplay=1`}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : row.kind === "link" ? (
          <a className="us-btn us-btn-primary" href={row.src} target="_blank" rel="noreferrer" style={{ padding: "11px 18px", textDecoration: "none" }}>
            Open in a new tab ↗
          </a>
        ) : loading ? (
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>Loading…</p>
        ) : audioUrl ? (
          <audio controls autoPlay src={audioUrl} style={{ width: "100%" }} />
        ) : (
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>Couldn't load this track.</p>
        )}
      </div>
    </div>
  );
}

// ---------- Music ----------
function MusicSection({ songs, myId, myName, flash, reload }) {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState(null); // { title, author, thumb } fetched for the typed link
  const [loading, setLoading] = useState(false);
  const [panel, setPanel] = useState(null);     // null | "link" | "upload"
  const [playing, setPlaying] = useState(null);  // the row currently in the player
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef(null);

  // Pull title/artist/cover from the link automatically.
  const lookUp = async (link) => {
    const u = link.trim();
    if (!u || isAudioSrc(u)) { setPreview(null); return; }
    setLoading(true);
    const meta = await fetchLinkMeta(u);
    setPreview(meta);
    setLoading(false);
  };

  const addLink = async () => {
    const u = url.trim();
    if (!u) return;
    setLoading(true);
    const meta = preview || (await fetchLinkMeta(u));
    const yt = getYouTubeId(u);
    const { error } = await supabase.from("songs").insert({
      kind: yt ? "yt" : "link",
      title: meta?.title || u,
      author_name: meta?.author || "",
      yt: yt || null,
      src: yt ? null : u,
      added_by: myId,
    });
    setLoading(false);
    setUrl(""); setPreview(null);
    if (error) { flash("Couldn't add that link — try again."); return; }
    await reload();
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/audio\//.test(file.type) && !/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name)) {
      flash("That doesn't look like an audio file — pick an mp3.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      flash("File larger than 25 MB — please use a shorter track.");
      return;
    }
    setUploading(true);
    const ext = (file.name.split(".").pop() || "mp3").toLowerCase();
    const path = `${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("music").upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) { setUploading(false); flash("Upload failed — please try again."); return; }
    const { error } = await supabase.from("songs").insert({
      kind: "audio",
      title: file.name.replace(/\.[^.]+$/, ""),
      author_name: myName,
      path,
      added_by: myId,
    });
    setUploading(false);
    if (error) { flash("Saved the file but couldn't list it — try again."); return; }
    await reload();
  };

  const removeSong = async (s) => {
    if (playing?.id === s.id) setPlaying(null);
    if (s.kind === "audio" && s.path) await supabase.storage.from("music").remove([s.path]);
    const { error } = await supabase.from("songs").delete().eq("id", s.id);
    if (error) flash("Couldn't remove that — try again.");
    await reload();
  };

  // Unified rows for the list.
  const rows = songs.map((s) => ({
    id: s.id,
    kind: s.kind,
    title: s.title || s.src || "Untitled",
    author: s.author_name || "",
    thumb: "",
    src: s.src,
    yt: s.yt,
    path: s.path,
    badge: s.kind === "yt" ? "YouTube" : s.kind === "audio" ? "Upload" : "Link",
    raw: s,
  }));

  const openPanel = (which) => setPanel((p) => (p === which ? null : which));

  return (
    <div className="us-enter" style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      {/* ===== Compact action buttons ===== */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className={`us-tab${panel === "link" ? " active" : ""}`} onClick={() => openPanel("link")}>
          <Plus size={16} /> Add by link
        </button>
        <button className={`us-tab${panel === "upload" ? " active" : ""}`} onClick={() => openPanel("upload")}>
          <Upload size={16} /> Upload file
        </button>
      </div>

      {/* ===== Add-by-link panel ===== */}
      {panel === "link" && (
        <section className="us-card us-enter" style={{ minWidth: 0 }}>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 12px" }}>
            Paste a link — the title, artist and cover fill in automatically. YouTube plays right here.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="us-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={(e) => lookUp(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addLink()}
              placeholder="Paste a music link (YouTube, SoundCloud…)"
            />
            <button className="us-btn us-btn-primary" onClick={addLink} disabled={loading}
              style={{ padding: "0 18px", whiteSpace: "nowrap" }}>
              {loading ? "…" : <><Plus size={18} /> Add</>}
            </button>
          </div>

          {preview && (
            <div className="us-enter" style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, padding: 10,
              background: "var(--night-deep)", borderRadius: 11, border: "1px solid var(--line)" }}>
              {preview.thumb
                ? <img src={preview.thumb} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover" }} />
                : <span style={{ width: 48, height: 48, borderRadius: 8, background: "var(--surface2)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Music size={20} color="var(--accent)" /></span>}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview.title || "Untitled"}</div>
                {preview.author && <div style={{ color: "var(--muted)", fontSize: 12 }}>{preview.author}</div>}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ===== Upload panel ===== */}
      {panel === "upload" && (
        <section className="us-card us-enter" style={{ minWidth: 0, background: "linear-gradient(135deg, var(--surface), var(--surface2))" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
              <div className="us-serif" style={{ fontSize: 20, fontWeight: 600, color: "var(--accent2)" }}>Upload a song</div>
              <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 2 }}>
                Save an mp3 you own — it's stored privately and you both can play it (up to 25 MB).
              </div>
            </div>
            <button className="us-btn us-btn-primary" onClick={() => fileInput.current?.click()} disabled={uploading}
              style={{ padding: "10px 18px", whiteSpace: "nowrap" }}>
              {uploading ? <Heart size={16} className="us-spin" /> : <Upload size={16} />} {uploading ? "Uploading…" : "Choose file"}
            </button>
            <input ref={fileInput} type="file" accept="audio/*,.mp3,.m4a,.flac" onChange={handleUpload} style={{ display: "none" }} />
          </div>
        </section>
      )}

      {/* ===== Now playing ===== */}
      {playing && <NowPlaying row={playing} onClose={() => setPlaying(null)} />}

      {/* ===== Song list ===== */}
      {rows.length === 0 ? (
        <div className="us-card" style={{ textAlign: "center", padding: "40px 22px" }}>
          <span style={{ width: 64, height: 64, borderRadius: 18, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(135deg, var(--accent), var(--accent2))", boxShadow: "0 10px 28px var(--glow)" }}>
            <Music size={28} color="var(--on-accent)" />
          </span>
          <p className="us-serif" style={{ color: "var(--text)", fontSize: 21, margin: "16px 0 4px" }}>No songs yet</p>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
            Tap “Add by link” above and paste a song — you’ll both be able to play it right here.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((r, i) => {
            const active = playing?.id === r.id;
            return (
              <div key={r.id} className="us-row us-enter" onClick={() => setPlaying(r)} role="button" tabIndex={0}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setPlaying(r)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", cursor: "pointer",
                  background: active ? "var(--surface2)" : "var(--surface)", border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`,
                  borderRadius: 14, animationDelay: `${i * 0.04}s` }}>
                {r.thumb
                  ? <img src={r.thumb} alt="" style={{ width: 46, height: 46, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                  : <span style={{ width: 46, height: 46, borderRadius: 10, flexShrink: 0, background: "linear-gradient(135deg, var(--accent), var(--accent2))", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Music size={20} color="var(--on-accent)" /></span>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                  <div style={{ color: "var(--muted)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.author ? `${r.author} · ${r.badge}` : r.badge}
                  </div>
                </div>
                <span aria-hidden style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
                  background: active ? "linear-gradient(135deg, var(--accent), var(--accent2))" : "transparent",
                  border: active ? "none" : "1px solid var(--line)", color: active ? "var(--on-accent)" : "var(--accent2)" }}>
                  <Play size={16} fill="currentColor" />
                </span>
                <button className="us-icon-btn" onClick={(e) => { e.stopPropagation(); removeSong(r.raw); }} aria-label="Remove song"><Trash2 size={16} /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- Videos ----------
// A sticky player panel for a chosen video (file, YouTube, TikTok, Instagram or link).
function VideoPlayer({ row, onClose }) {
  const [fileUrl, setFileUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    if (row.kind === "file" && row.path) {
      setLoading(true);
      supabase.storage.from("videos").createSignedUrl(row.path, 3600)
        .then(({ data }) => { if (alive) setFileUrl(data?.signedUrl || null); })
        .finally(() => { if (alive) setLoading(false); });
    }
    return () => { alive = false; };
  }, [row]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Build a privacy-friendly embed for the link kinds.
  let embedUrl = null;
  let pad = "56.25%"; // 16:9 default
  if (row.kind === "yt") {
    embedUrl = `https://www.youtube-nocookie.com/embed/${row.yt}?autoplay=1&rel=0`;
  } else if (row.kind === "tiktok") {
    const id = getTikTokId(row.src);
    embedUrl = id ? `https://www.tiktok.com/embed/v2/${id}` : null;
    pad = "150%"; // portrait
  } else if (row.kind === "instagram") {
    embedUrl = `${String(row.src).split("?")[0].replace(/\/$/, "")}/embed`;
    pad = "125%"; // mostly portrait
  }

  return (
    <div className="us-card us-enter-pop" style={{ position: "sticky", top: 78, zIndex: 6,
      background: "linear-gradient(135deg, var(--surface), var(--surface2))", boxShadow: "0 14px 44px rgba(0,0,0,.55)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <span style={{ width: 56, height: 56, borderRadius: 12, flexShrink: 0, background: "linear-gradient(135deg, var(--accent), var(--accent2))", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <VideoIcon size={24} color="var(--on-accent)" />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--accent2)", fontWeight: 700 }}>Now playing</div>
          <div style={{ fontSize: 17, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.title}</div>
          {row.author && <div style={{ color: "var(--muted)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.author}</div>}
        </div>
        <button className="us-icon-btn" onClick={onClose} aria-label="Close player"><X size={20} /></button>
      </div>

      {row.kind === "file" ? (
        loading ? (
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>Loading…</p>
        ) : fileUrl ? (
          <video src={fileUrl} controls autoPlay playsInline style={{ width: "100%", maxHeight: "70vh", borderRadius: 12, background: "#000", display: "block" }} />
        ) : (
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>Couldn't load this video.</p>
        )
      ) : embedUrl ? (
        <div style={{ position: "relative", paddingTop: pad, maxWidth: pad === "56.25%" ? "100%" : 420, marginInline: "auto", width: "100%", borderRadius: 12, overflow: "hidden", background: "#000" }}>
          <iframe
            title={row.title}
            src={embedUrl}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
      ) : (
        <a className="us-btn us-btn-primary" href={row.src} target="_blank" rel="noreferrer" style={{ padding: "11px 18px", textDecoration: "none" }}>
          Open in a new tab ↗
        </a>
      )}
    </div>
  );
}

function VideosSection({ videos, myId, myName, flash, reload }) {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [panel, setPanel] = useState(null);   // null | "link" | "upload"
  const [playing, setPlaying] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef(null);

  const lookUp = async (link) => {
    const u = link.trim();
    if (!u) { setPreview(null); return; }
    setLoading(true);
    setPreview(await fetchLinkMeta(u));
    setLoading(false);
  };

  const addLink = async () => {
    const u = url.trim();
    if (!u) return;
    setLoading(true);
    const meta = preview || (await fetchLinkMeta(u));
    const kind = classifyVideoLink(u);
    const { error } = await supabase.from("videos").insert({
      kind,
      title: meta?.title || u,
      author_name: meta?.author || "",
      yt: kind === "yt" ? getYouTubeId(u) : null,
      src: u,
      thumb: meta?.thumb || null,
      added_by: myId,
    });
    setLoading(false);
    setUrl(""); setPreview(null);
    if (error) { flash("Couldn't add that link — try again."); return; }
    await reload();
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/video\//.test(file.type) && !/\.(mp4|mov|webm|m4v|ogg)$/i.test(file.name)) {
      flash("That doesn't look like a video — pick an mp4/mov.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      flash("Video larger than 50 MB — please use a shorter clip.");
      return;
    }
    setUploading(true);
    const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
    const path = `${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("videos").upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) { setUploading(false); flash("Upload failed — please try again."); return; }
    const { error } = await supabase.from("videos").insert({
      kind: "file",
      title: file.name.replace(/\.[^.]+$/, ""),
      author_name: myName,
      path,
      added_by: myId,
    });
    setUploading(false);
    if (error) { flash("Saved the file but couldn't list it — try again."); return; }
    await reload();
  };

  const removeVideo = async (v) => {
    if (playing?.id === v.id) setPlaying(null);
    if (v.kind === "file" && v.path) await supabase.storage.from("videos").remove([v.path]);
    const { error } = await supabase.from("videos").delete().eq("id", v.id);
    if (error) flash("Couldn't remove that — try again.");
    await reload();
  };

  const badgeFor = (k) => ({ yt: "YouTube", tiktok: "TikTok", instagram: "Instagram", file: "Upload", link: "Link" }[k] || "Link");

  const rows = videos.map((v) => ({
    id: v.id, kind: v.kind, title: v.title || v.src || "Untitled", author: v.author_name || "",
    thumb: v.thumb || "", src: v.src, yt: v.yt, path: v.path, badge: badgeFor(v.kind), raw: v,
  }));

  const openPanel = (which) => setPanel((p) => (p === which ? null : which));

  return (
    <div className="us-enter" style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className={`us-tab${panel === "link" ? " active" : ""}`} onClick={() => openPanel("link")}>
          <Plus size={16} /> Add by link
        </button>
        <button className={`us-tab${panel === "upload" ? " active" : ""}`} onClick={() => openPanel("upload")}>
          <Upload size={16} /> Upload video
        </button>
      </div>

      {panel === "link" && (
        <section className="us-card us-enter" style={{ minWidth: 0 }}>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 12px" }}>
            Paste a TikTok, Instagram or YouTube link — it plays right here.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="us-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={(e) => lookUp(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addLink()}
              placeholder="Paste a video link (TikTok, Instagram, YouTube…)"
            />
            <button className="us-btn us-btn-primary" onClick={addLink} disabled={loading}
              style={{ padding: "0 18px", whiteSpace: "nowrap" }}>
              {loading ? "…" : <><Plus size={18} /> Add</>}
            </button>
          </div>
          {preview && (
            <div className="us-enter" style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, padding: 10,
              background: "var(--night-deep)", borderRadius: 11, border: "1px solid var(--line)" }}>
              {preview.thumb
                ? <img src={preview.thumb} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover" }} />
                : <span style={{ width: 48, height: 48, borderRadius: 8, background: "var(--surface2)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><VideoIcon size={20} color="var(--accent)" /></span>}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview.title || "Untitled"}</div>
                {preview.author && <div style={{ color: "var(--muted)", fontSize: 12 }}>{preview.author}</div>}
              </div>
            </div>
          )}
        </section>
      )}

      {panel === "upload" && (
        <section className="us-card us-enter" style={{ minWidth: 0, background: "linear-gradient(135deg, var(--surface), var(--surface2))" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
              <div className="us-serif" style={{ fontSize: 20, fontWeight: 600, color: "var(--accent2)" }}>Upload a video</div>
              <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 2 }}>
                A short clip (up to 50 MB), stored privately. Videos clear after 2 days.
              </div>
            </div>
            <button className="us-btn us-btn-primary" onClick={() => fileInput.current?.click()} disabled={uploading}
              style={{ padding: "10px 18px", whiteSpace: "nowrap" }}>
              {uploading ? <Heart size={16} className="us-spin" /> : <Upload size={16} />} {uploading ? "Uploading…" : "Choose file"}
            </button>
            <input ref={fileInput} type="file" accept="video/*,.mp4,.mov,.webm,.m4v" onChange={handleUpload} style={{ display: "none" }} />
          </div>
        </section>
      )}

      {playing && <VideoPlayer row={playing} onClose={() => setPlaying(null)} />}

      {rows.length === 0 ? (
        <div className="us-card" style={{ textAlign: "center", padding: "40px 22px" }}>
          <span style={{ width: 64, height: 64, borderRadius: 18, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(135deg, var(--accent), var(--accent2))", boxShadow: "0 10px 28px var(--glow)" }}>
            <VideoIcon size={28} color="var(--on-accent)" />
          </span>
          <p className="us-serif" style={{ color: "var(--text)", fontSize: 21, margin: "16px 0 4px" }}>No videos yet</p>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
            Paste a TikTok/Instagram/YouTube link, or upload a short clip — you’ll both see it here.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((r, i) => {
            const active = playing?.id === r.id;
            return (
              <div key={r.id} className="us-row us-enter" onClick={() => setPlaying(r)} role="button" tabIndex={0}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setPlaying(r)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", cursor: "pointer",
                  background: active ? "var(--surface2)" : "var(--surface)", border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`,
                  borderRadius: 14, animationDelay: `${i * 0.04}s` }}>
                {r.thumb
                  ? <img src={r.thumb} alt="" style={{ width: 46, height: 46, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                  : <span style={{ width: 46, height: 46, borderRadius: 10, flexShrink: 0, background: "linear-gradient(135deg, var(--accent), var(--accent2))", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><VideoIcon size={20} color="var(--on-accent)" /></span>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                  <div style={{ color: "var(--muted)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.author ? `${r.author} · ${r.badge}` : r.badge}
                  </div>
                </div>
                <span aria-hidden style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
                  background: active ? "linear-gradient(135deg, var(--accent), var(--accent2))" : "transparent",
                  border: active ? "none" : "1px solid var(--line)", color: active ? "var(--on-accent)" : "var(--accent2)" }}>
                  <Play size={16} fill="currentColor" />
                </span>
                <button className="us-icon-btn" onClick={(e) => { e.stopPropagation(); removeVideo(r.raw); }} aria-label="Remove video"><Trash2 size={16} /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- Notes (shared notebook) ----------
function Notes({ notes, myId, idToName, flash, reload }) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const fmtTime = (iso) =>
    new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  const add = async () => {
    const t = draft.trim();
    if (!t) return;
    setBusy(true);
    setDraft("");
    const { error } = await supabase.from("notes").insert({ text: t, author: myId });
    setBusy(false);
    if (error) { flash("Couldn't save your note — try again."); setDraft(t); return; }
    await reload();
  };

  const remove = async (id) => {
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) flash("Couldn't remove that — try again.");
    await reload();
  };

  return (
    <div className="us-enter" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Write box */}
      <div className="us-card" style={{ background: "linear-gradient(135deg, var(--surface), var(--surface2))" }}>
        <div className="us-serif" style={{ fontSize: 22, fontWeight: 600, color: "var(--accent2)", marginBottom: 4 }}>Our notebook</div>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 12px" }}>
          Write anything — how you feel, a thought, a little message. You’ll both see it here.
        </p>
        <textarea
          className="us-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) add(); }}
          placeholder="What's on your heart?"
          rows={3}
          style={{ resize: "vertical", minHeight: 84, lineHeight: 1.5 }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button className="us-btn us-btn-primary" onClick={add} disabled={busy || !draft.trim()} style={{ padding: "10px 18px" }}>
            {busy ? <Heart size={16} className="us-spin" /> : <Send size={16} />} Write it down
          </button>
        </div>
      </div>

      {/* Entries */}
      {notes.length === 0 ? (
        <div className="us-card" style={{ textAlign: "center", padding: "44px 22px" }}>
          <span style={{ width: 68, height: 68, borderRadius: 20, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(135deg, var(--accent), var(--accent2))", boxShadow: "0 12px 30px var(--glow)" }}>
            <NotebookPen size={30} color="var(--on-accent)" />
          </span>
          <p className="us-serif" style={{ color: "var(--text)", fontSize: 21, margin: "16px 0 4px" }}>Nothing written yet</p>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0, maxWidth: 360, marginInline: "auto", lineHeight: 1.6 }}>
            This is your shared little book. Whatever you write here, the other one will see.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {notes.map((n, i) => {
            const mine = n.author === myId;
            return (
              <div key={n.id} className="us-card us-enter" style={{ padding: "16px 18px", animationDelay: `${i * 0.04}s`,
                borderLeft: `3px solid ${mine ? "var(--accent)" : "var(--gold)"}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <Heart size={13} fill={mine ? "var(--accent)" : "var(--gold)"} color={mine ? "var(--accent)" : "var(--gold)"} />
                    <span style={{ fontWeight: 700, fontSize: 14, color: mine ? "var(--accent2)" : "var(--gold)" }}>
                      {idToName[n.author] || "Someone"}
                    </span>
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>· {fmtTime(n.created_at)}</span>
                  </div>
                  <button className="us-icon-btn" onClick={() => remove(n.id)} aria-label="Delete note"><Trash2 size={15} /></button>
                </div>
                <div style={{ fontSize: 15, lineHeight: 1.6, color: "var(--text)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{n.text}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
