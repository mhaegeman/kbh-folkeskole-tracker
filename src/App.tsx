import { useEffect, useState } from 'react';
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { BarChart3, Globe2, Info, Map as MapIcon, Moon, Star, Sun } from 'lucide-react';
import clsx from 'clsx';
import { StoreProvider, useStore } from './lib/store';
import Explore from './pages/Explore';
import SchoolPage from './pages/SchoolPage';
import MapPage from './pages/MapPage';
import Compare from './pages/Compare';
import International from './pages/International';
import About from './pages/About';

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark' | null>(() => {
    try { return (localStorage.getItem('kbh.theme') as 'light' | 'dark' | null) ?? null; } catch { return null; }
  });
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
    try { if (theme) localStorage.setItem('kbh.theme', theme); } catch { /* ignore */ }
  }, [theme]);
  const isDark = theme === 'dark' || (!theme && matchMedia('(prefers-color-scheme: dark)').matches);
  return { isDark, toggle: () => setTheme(isDark ? 'light' : 'dark') };
}

function Nav() {
  const { shortlist } = useStore();
  const { isDark, toggle } = useTheme();
  const link = ({ isActive }: { isActive: boolean }) =>
    clsx('flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition', isActive ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-surface-2 hover:text-ink');
  return (
    <header className="sticky top-0 z-[1100] h-16 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1400px] items-center gap-2 px-4 sm:px-6">
        <NavLink to="/" className="mr-3 flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-ink">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none"><path d="M4 12l12-7 12 7-12 7z" fill="currentColor" /><path d="M9 15v6c0 2 3 4 7 4s7-2 7-4v-6" stroke="currentColor" strokeWidth="2.5" /></svg>
          </span>
          <span className="hidden font-display text-lg font-semibold sm:block">Skolekort KBH</span>
        </NavLink>
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto scrollbar-thin">
          <NavLink to="/" end className={link}><BarChart3 size={16} /> <span className="hidden sm:inline">Rankings</span></NavLink>
          <NavLink to="/map" className={link}><MapIcon size={16} /> <span className="hidden sm:inline">Map</span></NavLink>
          <NavLink to="/international" className={link}><Globe2 size={16} /> <span className="hidden sm:inline">International</span></NavLink>
          <NavLink to="/compare" className={link}>
            <Star size={16} /> <span className="hidden sm:inline">Compare</span>
            {shortlist.length > 0 && <span className="rounded-full bg-[var(--series-2)] px-1.5 text-[11px] font-semibold text-white">{shortlist.length}</span>}
          </NavLink>
          <NavLink to="/about" className={link}><Info size={16} /> <span className="hidden sm:inline">About</span></NavLink>
        </nav>
        <button className="rounded-lg p-2 text-ink-2 hover:bg-surface-2" onClick={toggle} aria-label="Toggle dark mode">
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function Shell() {
  const { data, error } = useStore();
  return (
    <div className="min-h-full">
      <Nav />
      <ScrollTop />
      {error ? (
        <div className="p-10 text-center text-bad">Could not load data: {error}. Run <code>npm run data:build</code>.</div>
      ) : !data ? (
        <div className="grid h-[60vh] place-items-center text-ink-3">Loading schools…</div>
      ) : (
        <Routes>
          <Route path="/" element={<Explore />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/school/:id" element={<SchoolPage />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/international" element={<International />} />
          <Route path="/about" element={<About />} />
        </Routes>
      )}
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </HashRouter>
  );
}
