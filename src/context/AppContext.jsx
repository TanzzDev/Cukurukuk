import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';
import { emit, on } from '../services/bus';
import { guestSummary, mergeGuestIntoAccount, pullLibrary, startCloudSync } from '../services/cloud';
import { deviceTz, flushOutbox, pullListening, setStreakRules, settleLocal } from '../services/listening';
import { setScope } from '../services/storage';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

const GUEST_PROFILE = Object.freeze({ id: 'guest', name: 'Tamu', email: '', avatarUrl: '', isGuest: true });
const OFFLINE_CONFIG = Object.freeze({ features: {}, streakRules: null, offline: true });

export function AppProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [mergeOffer, setMergeOffer] = useState(null);
  const syncOff = useRef(null);

  const attach = useCallback((u, { offerMerge }) => {
    setScope(u.id);
    setUser(u);
    syncOff.current?.();
    syncOff.current = startCloudSync();
    // data akun dimuat di latar belakang; UI langsung memakai salinan lokal akun tersebut
    Promise.allSettled([pullLibrary(), pullListening()]).then(() => { settleLocal(); flushOutbox(); });
    if (offerMerge) {
      const key = `drowify:merge:${u.id}`;
      const summary = guestSummary();
      if (summary && !localStorage.getItem(key)) setMergeOffer({ summary, key });
    }
  }, []);

  const detach = useCallback(() => {
    syncOff.current?.();
    syncOff.current = null;
    setUser(null);
    setScope('guest');
    setMergeOffer(null);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [cfg, sess] = await Promise.allSettled([
        api('/api/config', { timeout: 4000 }),
        api('/api/auth/session', { timeout: 4000 }),
      ]);
      if (!alive) return;
      if (cfg.status === 'fulfilled') {
        setConfig(cfg.value);
        if (cfg.value.streakRules) setStreakRules(cfg.value.streakRules);
      } else setConfig(OFFLINE_CONFIG);
      if (sess.status === 'fulfilled' && sess.value.user) attach(sess.value.user, { offerMerge: false });
      else settleLocal();
      setReady(true);
    })();
    return () => { alive = false; };
  }, [attach]);

  useEffect(() => on('unauthorized', () => {
    detach();
    emit('toast', 'Sesi berakhir. Silakan masuk lagi.');
  }), [detach]);

  useEffect(() => {
    const t = setInterval(() => settleLocal(), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const login = useCallback(async (credential) => {
    const res = await api('/api/auth/google', { method: 'POST', json: { credential, tz: deviceTz() } });
    attach(res.user, { offerMerge: true });
    return res.user;
  }, [attach]);

  const logout = useCallback(async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch (_) { /* tetap keluar secara lokal */ }
    detach();
  }, [detach]);

  const updateProfile = useCallback(async (patch) => {
    const r = await api('/api/me', { method: 'PATCH', json: patch });
    setUser(r.user);
    return r.user;
  }, []);

  const uploadAvatar = useCallback(async (blob) => {
    const r = await api('/api/me/avatar', { method: 'POST', body: blob, headers: { 'Content-Type': blob.type }, timeout: 20000 });
    setUser(r.user);
    return r.user;
  }, []);

  const resetAvatar = useCallback(async () => {
    const r = await api('/api/me/avatar', { method: 'DELETE' });
    setUser(r.user);
    return r.user;
  }, []);

  const acceptMerge = useCallback(async () => {
    if (!mergeOffer) return;
    await mergeGuestIntoAccount();
    localStorage.setItem(mergeOffer.key, 'merged');
    setMergeOffer(null);
    emit('toast', 'Data tamu digabungkan ke akunmu.');
  }, [mergeOffer]);

  const skipMerge = useCallback(() => {
    if (mergeOffer) localStorage.setItem(mergeOffer.key, 'skipped');
    setMergeOffer(null);
  }, [mergeOffer]);

  const profile = useMemo(() => (user ? { ...user, isGuest: false } : GUEST_PROFILE), [user]);
  const value = useMemo(() => ({
    config, ready, user, profile, isGuest: !user, mergeOffer,
    login, logout, updateProfile, uploadAvatar, resetAvatar, acceptMerge, skipMerge,
    features: config?.features || {},
  }), [config, ready, user, profile, mergeOffer, login, logout, updateProfile, uploadAvatar, resetAvatar, acceptMerge, skipMerge]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
