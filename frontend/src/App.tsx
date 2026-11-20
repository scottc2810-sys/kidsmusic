import { NativeVoices } from "./pages/NativeVoices";
import { ParentChat } from "./pages/ParentChat";
import { StarMap } from "./pages/StarMap";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { api, type Parent } from "./api";
import { useReminders } from "./hooks/useReminders";
import { ConnectClaude } from "./pages/ConnectClaude";
import { Dashboard } from "./pages/Dashboard";
import { KidHome } from "./pages/KidHome";
import { Lesson } from "./pages/Lesson";
import { Login } from "./pages/Login";
import { ProgressPage } from "./pages/ProgressPage";
import { Recordings } from "./pages/Recordings";
import { Settings } from "./pages/Settings";
import { SongLesson, SongList } from "./pages/SongSchool";
import { Basics, BasicsTopic } from "./pages/Basics";
import { FreePiano, TalkToMelo } from "./pages/KidExtras";
import { LanguageLesson, LanguageList } from "./pages/Learn";
import { CompareLanguages } from "./pages/Compare";

interface AuthCtx { parent: Parent | null; loading: boolean; refresh: () => Promise<void>; setParent: (p: Parent | null) => void }
const Auth = createContext<AuthCtx>({ parent: null, loading: true, refresh: async () => {}, setParent: () => {} });
export const useAuth = () => useContext(Auth);

function RequireAuth({ children }: { children: JSX.Element }) {
  const { parent, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="center-screen"><div className="spinner" aria-label="Loading" /></div>;
  if (!parent) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return children;
}

export function App() {
  const [parent, setParent] = useState<Parent | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try { setParent(await api.me()); } catch { setParent(null); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const reminder = useReminders(!!parent);

  return (
    <Auth.Provider value={{ parent, loading, refresh, setParent }}>
      {reminder && <div className="reminder-banner" role="status">🎵 {reminder}</div>}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/parent" replace />} />
        <Route path="/parent" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/parent/connect" element={<RequireAuth><ConnectClaude /></RequireAuth>} />
        <Route path="/parent/child/:id/settings" element={<RequireAuth><Settings /></RequireAuth>} />
        <Route path="/parent/child/:id/progress" element={<RequireAuth><ProgressPage /></RequireAuth>} />
        <Route path="/parent/child/:id/voices" element={<RequireAuth><NativeVoices /></RequireAuth>} />
        <Route path="/parent/child/:id/chat" element={<RequireAuth><ParentChat /></RequireAuth>} />
        <Route path="/parent/child/:id/recordings" element={<RequireAuth><Recordings /></RequireAuth>} />
        <Route path="/play/:id" element={<RequireAuth><KidHome /></RequireAuth>} />
        <Route path="/play/:id/lesson" element={<RequireAuth><Lesson /></RequireAuth>} />
        <Route path="/play/:id/basics" element={<RequireAuth><Basics /></RequireAuth>} />
        <Route path="/play/:id/basics/:topic" element={<RequireAuth><BasicsTopic /></RequireAuth>} />
        <Route path="/play/:id/songs" element={<RequireAuth><SongList /></RequireAuth>} />
        <Route path="/play/:id/songs/:songId" element={<RequireAuth><SongLesson /></RequireAuth>} />
        <Route path="/play/:id/piano" element={<RequireAuth><FreePiano /></RequireAuth>} />
        <Route path="/play/:id/learn" element={<RequireAuth><LanguageList /></RequireAuth>} />
        <Route path="/play/:id/learn-compare" element={<RequireAuth><CompareLanguages /></RequireAuth>} />
        <Route path="/play/:id/learn/:lang" element={<RequireAuth><LanguageLesson /></RequireAuth>} />
        <Route path="/play/:id/stars" element={<RequireAuth><StarMap /></RequireAuth>} />
        <Route path="/play/:id/talk" element={<RequireAuth><TalkToMelo /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/parent" replace />} />
      </Routes>
    </Auth.Provider>
  );
}
