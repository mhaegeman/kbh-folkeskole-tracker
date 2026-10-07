import { useEffect, useState } from 'react';
import { HashRouter, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Compass, Globe2, Info, Moon, Star, Sun } from 'lucide-react';
import clsx from 'clsx';
import { StoreProvider, useStore } from './lib/store';
import { AddressSearch } from './components/AddressSearch';
import Explore from './pages/Explore';
import SchoolPage from './pages/SchoolPage';
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

const NAV = [
  { to: '/', label: 'Explore', icon: Compass, end: true },
  { to: '/international', label: 'International', icon: Globe2 },
  { to: '/compare', label: 'Shortlist', icon: Star },
  { to: '/about', label: 'About the score', short: 'About', icon: Info },
] as const;

function Logo() {
  return (
    <NavLink to="/" className="flex shrink-0 items-center gap-2.5" aria-label="Skolekort KBH, home">
      <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-accent text-accent-ink">
        <svg width="19" height="19" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M4 12l12-7 12 7-12 7z" fill="currentColor" /><path d="M9 15v6c0 2 3 4 7 4s7-2 7-4v-6" stroke="currentColor" strokeWidth="2.5" /></svg>
      </span>
      <span className="hidden text-lg font-extrabold tracking-tight lg:block">Skolekort <span className="text-ink-3">KBH</span></span>
    </NavLink>
  );
}

function Header() {
  const { shortlist, home, setHome } = useStore();
  const { isDark, toggle } = useTheme();
  return (
    <header className="sticky top-0 z-[1100] border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-[var(--header-h)] max-w-[1600px] items-center gap-3 px-3 sm:gap-5 sm:px-6">
        <Logo />
        <AddressSearch value={home} onChange={setHome} className="min-w-0 flex-1 md:max-w-[560px]" />
        <nav aria-label="Main" className="ml-auto hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={'end' in n ? n.end : false}
              className={({ isActive }) => clsx('relative flex h-11 items-center gap-1.5 rounded-full px-3.5 text-[15px] transition',
                isActive ? 'bg-accent-soft font-bold text-accent' : 'font-medium text-ink-2 hover:bg-surface-2 hover:text-ink')}>
              {n.to === '/compare' ? <>Shortlist{shortlist.length > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-highlight px-1 text-xs font-bold text-highlight-ink">{shortlist.length}</span>}</> : n.label}
            </NavLink>
          ))}
        </nav>
        <button className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-surface-2" onClick={toggle} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
          {isDark ? <Sun size={19} /> : <Moon size={19} />}
        </button>
      </div>
    </header>
  );
}

function TabBar() {
  const { shortlist } = useStore();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-[1100] grid h-[var(--tabbar-h)] grid-cols-4 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} end={'end' in n ? n.end : false}
          className={({ isActive }) => clsx('flex flex-col items-center justify-center gap-0.5 text-xs', isActive ? 'font-bold text-accent' : 'font-medium text-ink-2')}>
          <span className="relative">
            <n.icon size={22} aria-hidden="true" />
            {n.to === '/compare' && shortlist.length > 0 && (
              <span className="absolute -right-2.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-highlight px-1 text-[11px] font-bold text-highlight-ink">{shortlist.length}</span>
            )}
          </span>
          {'short' in n ? n.short : n.label}
        </NavLink>
      ))}
    </nav>
  );
}

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

/** The old /map route now lives on Explore; keep links like #/map?school=… working. */
function MapRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/${search}`} replace />;
}

function Shell() {
  const { data, error } = useStore();
  return (
    <div className="min-h-full pb-[var(--tabbar-h)] md:pb-0">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[2000] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink">Skip to content</a>
      <Header />
      <ScrollTop />
      <main id="main">
        {error ? (
          <div className="p-10 text-center text-bad">Could not load data: {error}. Run <code>npm run data:build</code>.</div>
        ) : !data ? (
          <div className="grid h-[60vh] place-items-center text-ink-3">Loading schools…</div>
        ) : (
          <Routes>
            <Route path="/" element={<Explore />} />
            <Route path="/map" element={<MapRedirect />} />
            <Route path="/school/:id" element={<SchoolPage />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/international" element={<International />} />
            <Route path="/about" element={<About />} />
          </Routes>
        )}
      </main>
      <TabBar />
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
