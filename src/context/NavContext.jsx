import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// Rute aplikasi (URL bersih). Perpindahan halaman TIDAK memuat ulang aplikasi; audio tetap berjalan.
const PATHS = {
  home: '/', search: '/cari', library: '/pustaka', profile: '/kamu', streak: '/streak',
  history: '/riwayat', top: '/teratas', liked: '/disukai', settings: '/pengaturan',
};
const BY_PATH = Object.fromEntries(Object.entries(PATHS).map(([k, v]) => [v, k]));
const PRIMARY = { home: 'home', search: 'search', library: 'library', playlist: 'library', liked: 'library', profile: 'profile', streak: 'profile', history: 'profile', top: 'profile', settings: 'profile' };

export function parsePath(pathname) {
  const p = (pathname.replace(/\/+$/, '') || '/');
  if (BY_PATH[p]) return { name: BY_PATH[p] };
  const m = p.match(/^\/playlist\/([\w-]+)$/);
  if (m) return { name: 'playlist', id: m[1] };
  if (p === '/spotify/callback') return { name: 'library', spotifyCallback: true };
  return { name: 'home' };
}

export function pathFor(route, q) {
  if (route.name === 'playlist') return `/playlist/${route.id}`;
  const base = PATHS[route.name] || '/';
  return route.name === 'search' && q ? `${base}?q=${encodeURIComponent(q)}` : base;
}

const NavContext = createContext(null);
export const useNav = () => useContext(NavContext);

export function NavProvider({ children }) {
  const [route, setRoute] = useState(() => parsePath(window.location.pathname));
  const [searchQuery, setSearchQueryState] = useState(() => new URLSearchParams(window.location.search).get('q') || '');
  const depth = useRef(0);

  useEffect(() => {
    const onPop = () => {
      setRoute(parsePath(window.location.pathname));
      setSearchQueryState(new URLSearchParams(window.location.search).get('q') || '');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((name, params = {}) => {
    const next = { name, ...params };
    const url = pathFor(next, params.q);
    if (url !== window.location.pathname + window.location.search) {
      window.history.pushState({ app: true }, '', url);
      depth.current += 1;
    }
    setRoute(next);
    if (name === 'search' && params.q !== undefined) setSearchQueryState(params.q);
    window.scrollTo?.(0, 0);
  }, []);

  const back = useCallback((fallback = 'home') => {
    if (depth.current > 0) { depth.current -= 1; window.history.back(); }
    else navigate(fallback);
  }, [navigate]);

  const setSearchQuery = useCallback((q) => {
    setSearchQueryState(q);
    const url = pathFor({ name: 'search' }, q);
    window.history.replaceState({ app: true }, '', url);
  }, []);

  const value = useMemo(() => ({
    route, navigate, back, searchQuery, setSearchQuery, primary: PRIMARY[route.name] || 'home',
  }), [route, navigate, back, searchQuery, setSearchQuery]);
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}
