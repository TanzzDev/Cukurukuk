import { addDays, dateKey, isDateKey, isValidTimeZone, startOfWeekKey } from './dates.js';
import {
  DEFAULT_RULES, EVENT_MAX_SECONDS, HISTORY_LIMIT, LIVE_LIMIT,
  MAX_CREDIT_SECONDS, PLAY_MIN_SECONDS, SEEN_LIMIT, SERVER_TS_WINDOW_MS, TRACKS_LIMIT,
} from './config.js';
import { computeStreak, normalizeRules, streakRecord } from './streak.js';

const round1 = (n) => Math.round(n * 10) / 10;
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

/**
 * State dengar per pengguna (atau tamu):
 *  daily   { 'YYYY-MM-DD': { s: detik valid, n: sesi putar, p: pemutaran valid } }
 *  tracks  { [id]: { t, a, c, aid, p: pemutaran, s: detik, l: terakhir, f: pertama } }
 *  history [{ id: sesi, k: trackId, t: mulai(ms), s: detik, d: tanggal }]  (terbaru dulu)
 *  seen    id event yang sudah diproses (idempotensi)
 *  live    akumulasi per sesi putar yang sedang berjalan
 *  clock   { ts, credit } batas "tidak boleh > waktu nyata" (dipakai server)
 *  unlocked / celebrated  milestone yang sudah terbuka / sudah dirayakan di UI
 */
export function createListeningState(tz = 'UTC', now = Date.now()) {
  return {
    v: 1,
    tz: isValidTimeZone(tz) ? tz : 'UTC',
    daily: {},
    tracks: {},
    history: [],
    seen: [],
    live: {},
    clock: { ts: 0, credit: 0 },
    unlocked: {},
    celebrated: {},
    recovery: null,
    lastPlayAt: 0,
    rec: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** Bersihkan data mentah (localStorage / server) menjadi state valid. */
export function normalizeState(raw, tz) {
  const base = createListeningState(tz || raw?.tz);
  if (!isObj(raw)) return base;
  const s = { ...base };
  if (isValidTimeZone(raw.tz)) s.tz = raw.tz;
  if (isObj(raw.daily)) {
    for (const [k, e] of Object.entries(raw.daily)) {
      if (!isDateKey(k) || !isObj(e)) continue;
      const sec = Number(e.s);
      if (!Number.isFinite(sec) || sec < 0) continue;
      s.daily[k] = { s: round1(sec), n: Math.max(0, Number(e.n) || 0), p: Math.max(0, Number(e.p) || 0) };
    }
  }
  if (isObj(raw.tracks)) {
    for (const [k, t] of Object.entries(raw.tracks)) {
      if (!k || !isObj(t)) continue;
      s.tracks[k] = {
        t: String(t.t || '').slice(0, 160),
        a: String(t.a || '').slice(0, 120),
        c: String(t.c || '').slice(0, 300),
        aid: String(t.aid || '').slice(0, 64),
        p: Math.max(0, Number(t.p) || 0),
        s: round1(Math.max(0, Number(t.s) || 0)),
        l: Number(t.l) || 0,
        f: Number(t.f) || 0,
      };
    }
  }
  if (Array.isArray(raw.history)) {
    s.history = raw.history
      .filter((h) => isObj(h) && typeof h.k === 'string' && typeof h.id === 'string' && isDateKey(h.d))
      .map((h) => ({ id: h.id, k: h.k, t: Number(h.t) || 0, s: round1(Number(h.s) || 0), d: h.d }))
      .slice(0, HISTORY_LIMIT);
  }
  if (Array.isArray(raw.seen)) s.seen = raw.seen.filter((x) => typeof x === 'string').slice(-SEEN_LIMIT);
  if (isObj(raw.live)) {
    for (const [sid, L] of Object.entries(raw.live).slice(-LIVE_LIMIT)) {
      if (isObj(L)) s.live[sid] = { k: String(L.k || ''), acc: Number(L.acc) || 0, counted: !!L.counted, t0: Number(L.t0) || 0 };
    }
  }
  if (isObj(raw.clock)) s.clock = { ts: Number(raw.clock.ts) || 0, credit: Number(raw.clock.credit) || 0 };
  if (isObj(raw.unlocked)) {
    for (const [days, v] of Object.entries(raw.unlocked)) if (Number.isInteger(Number(days)) && isDateKey(v)) s.unlocked[days] = v;
  }
  if (isObj(raw.celebrated)) {
    for (const [id, v] of Object.entries(raw.celebrated)) if (/^[mr]:[0-9-]{1,10}$/.test(id)) s.celebrated[id] = Number(v) || 1;
  }
  if (isObj(raw.recovery) && typeof raw.recovery.forLast === 'string' && isDateKey(raw.recovery.forLast)
      && Number.isFinite(raw.recovery.startedAt) && Number.isFinite(raw.recovery.expiresAt)) {
    s.recovery = {
      forLast: raw.recovery.forLast,
      startedAt: raw.recovery.startedAt,
      expiresAt: raw.recovery.expiresAt,
      tz: isValidTimeZone(raw.recovery.tz) ? raw.recovery.tz : s.tz,
    };
  }
  s.lastPlayAt = Number(raw.lastPlayAt) || 0;
  s.rec = isObj(raw.rec) ? raw.rec : null;
  s.createdAt = Number(raw.createdAt) || base.createdAt;
  s.updatedAt = Number(raw.updatedAt) || base.updatedAt;
  return s;
}

export function minPlaySeconds(duration) {
  const d = Number(duration);
  return d > 0 ? Math.min(PLAY_MIN_SECONDS, Math.max(5, d / 2)) : PLAY_MIN_SECONDS;
}

/**
 * Terapkan satu event dengar. IDEMPOTEN (id event yang sama diabaikan).
 *  ev  = { id, sid, track: { id, title, artist, cover, artistId, duration }, seconds, ts }
 *  ctx = { now, tz, targetSec, strict }
 * strict (server): timestamp klien hanya dipercaya dalam jendela jam server, dan detik yang
 * diterima tidak boleh melebihi waktu nyata -> perangkat/tab ganda tidak melipatgandakan waktu.
 */
export function applyListening(state, ev, ctx = {}) {
  const now = ctx.now ?? Date.now();
  const tz = isValidTimeZone(ctx.tz) ? ctx.tz : state.tz || 'UTC';
  const rules = normalizeRules(ctx.rules || DEFAULT_RULES);
  const strict = ctx.strict === true;

  const id = typeof ev?.id === 'string' ? ev.id.slice(0, 120) : '';
  const sid = typeof ev?.sid === 'string' ? ev.sid.slice(0, 100) : '';
  const tr = isObj(ev?.track) ? ev.track : {};
  const k = typeof tr.id === 'string' ? tr.id.slice(0, 64) : '';
  let seconds = Number(ev?.seconds);
  if (!id || !sid || !k || !Number.isFinite(seconds) || seconds <= 0) {
    return { state, accepted: 0, rejected: 'invalid', newlyUnlocked: [] };
  }
  if (state.seen.includes(id)) return { state, accepted: 0, rejected: 'duplicate', newlyUnlocked: [] };
  seconds = Math.min(seconds, EVENT_MAX_SECONDS);

  let ts = Number(ev.ts);
  if (!Number.isFinite(ts)) ts = now;
  if (strict && (ts < now - SERVER_TS_WINDOW_MS || ts > now + 120000)) ts = now;
  if (!strict && ts > now + 120000) ts = now;

  const prevClock = state.clock || { ts: 0, credit: 0 };
  let accepted = seconds;
  let clock;
  if (strict) {
    let credit =
      prevClock.ts > 0
        ? Math.min(MAX_CREDIT_SECONDS, prevClock.credit + Math.max(0, (ts - prevClock.ts) / 1000))
        : EVENT_MAX_SECONDS;
    accepted = Math.min(seconds, credit + 3); // +3 detik toleransi jitter, tidak menumpuk (kredit boleh -3)
    credit -= accepted;
    clock = { ts: Math.max(ts, prevClock.ts), credit };
  } else {
    clock = { ts: Math.max(ts, prevClock.ts || 0), credit: 0 };
  }
  const seen = [...state.seen, id].slice(-SEEN_LIMIT);
  if (accepted <= 0.05) {
    return { state: { ...state, seen, clock }, accepted: 0, rejected: 'no_credit', newlyUnlocked: [] };
  }
  accepted = round1(accepted);

  const d = dateKey(ts, tz);
  const daily = { ...state.daily };
  const day = { ...(daily[d] || { s: 0, n: 0, p: 0 }) };
  day.s = round1(day.s + accepted);

  const live = { ...state.live };
  const isNewSession = !live[sid];
  const L = live[sid] ? { ...live[sid] } : { k, acc: 0, counted: false, t0: ts };
  if (isNewSession) day.n += 1;
  L.acc = round1(L.acc + accepted);

  const tracks = { ...state.tracks };
  const prev = tracks[k];
  const T = {
    t: tr.title ? String(tr.title).slice(0, 160) : prev?.t || '',
    a: tr.artist ? String(tr.artist).slice(0, 120) : prev?.a || '',
    c: tr.cover ? String(tr.cover).slice(0, 300) : prev?.c || '',
    aid: tr.artistId ? String(tr.artistId).slice(0, 64) : prev?.aid || '',
    p: prev?.p || 0,
    s: round1((prev?.s || 0) + accepted),
    l: ts,
    f: prev?.f || ts,
  };

  let history = state.history;
  let lastPlayAt = state.lastPlayAt || 0;
  if (!L.counted && L.acc >= minPlaySeconds(tr.duration)) {
    L.counted = true;
    T.p += 1;
    day.p += 1;
    lastPlayAt = Math.max(lastPlayAt, ts);
    history = [{ id: sid, k, t: L.t0, s: L.acc, d }, ...history];
    if (history.length > HISTORY_LIMIT) history = history.slice(0, HISTORY_LIMIT);
  } else if (L.counted) {
    const idx = history.findIndex((h, i) => i < 40 && h.id === sid);
    if (idx !== -1) {
      history = history.slice();
      history[idx] = { ...history[idx], s: L.acc };
    }
  }

  tracks[k] = T;
  daily[d] = day;
  live[sid] = L;
  const liveIds = Object.keys(live);
  if (liveIds.length > LIVE_LIMIT) {
    liveIds
      .filter((x) => x !== sid)
      .sort((a, b) => live[a].t0 - live[b].t0)
      .slice(0, liveIds.length - LIVE_LIMIT)
      .forEach((x) => delete live[x]);
  }
  const trackIds = Object.keys(tracks);
  if (trackIds.length > TRACKS_LIMIT) {
    trackIds
      .filter((x) => x !== k)
      .sort((a, b) => tracks[a].p - tracks[b].p || tracks[a].l - tracks[b].l)
      .slice(0, trackIds.length - TRACKS_LIMIT)
      .forEach((x) => delete tracks[x]);
  }

  const base = { now, tz, rules, unlocked: state.unlocked, meta: state.recovery };
  const before = computeStreak(state.daily, base);
  const streak = computeStreak(daily, base);
  const unlocked = { ...state.unlocked };
  const newlyUnlocked = [];
  for (const m of streak.milestones) {
    if (m.achievedAt && !unlocked[m.days]) {
      unlocked[m.days] = m.achievedAt;
      newlyUnlocked.push(m.days);
    }
  }
  // transisi hari ini: api dipulihkan / streak baru dimulai / streak bertambah
  let transition = null;
  if (!before.todayQualified && streak.todayQualified) {
    transition = before.status === 'DORMANT' ? 'recovered' : before.status === 'ACTIVE' ? 'extended' : 'started';
  }
  const next = { ...state, tz, daily, tracks, history, seen, live, clock, unlocked, lastPlayAt, updatedAt: now };
  return { state: withSettled(next, streak, now, tz), accepted, newlyUnlocked, streak, transition };
}

function metaOf(streak, tz) {
  const r = streak.recovery;
  return r ? { forLast: r.forLast, startedAt: r.startedAt, expiresAt: r.expiresAt, tz: r.tz || tz } : null;
}

/** Simpan instan masa pemulihan & rekaman streak (hasil turunan yang aman dihitung ulang). */
function withSettled(state, streak, now, tz) {
  const rec = streakRecord(streak, { lastPlayAt: state.lastPlayAt, updatedAt: now });
  return { ...state, recovery: metaOf(streak, tz), rec };
}

/**
 * Hitung ulang status dari data tersimpan (mis. saat aplikasi dibuka, tanpa event baru).
 * Mengunci instan pemulihan saat DORMANT pertama kali terdeteksi; tidak menggeser/ memperpanjangnya sesudahnya.
 */
export function settleState(state, ctx = {}) {
  const now = ctx.now ?? Date.now();
  const tz = isValidTimeZone(ctx.tz) ? ctx.tz : state.tz || 'UTC';
  const rules = normalizeRules(ctx.rules || DEFAULT_RULES);
  const streak = computeStreak(state.daily, { now, tz, rules, unlocked: state.unlocked, meta: state.recovery });
  const next = withSettled(state, streak, now, tz);
  const sig = (x) => JSON.stringify([x.recovery, x.rec && { ...x.rec, updated_at: 0 }]);
  const changed = sig(next) !== sig(state);
  return { state: changed ? next : state, streak, changed };
}

/** Tandai perayaan sudah ditampilkan (id: 'm:<hari>' milestone, 'r:<tanggal>' pemulihan api). */
export function markCelebrated(state, ids, now = Date.now()) {
  const celebrated = { ...state.celebrated };
  for (const id of ids) if (/^[mr]:[0-9-]{1,10}$/.test(String(id))) celebrated[id] = now;
  return { ...state, celebrated };
}

/** Perayaan yang BARU terjadi hari ini dan belum pernah ditampilkan (milestone baru, api menyala kembali). */
export function pendingCelebrations(state, streak) {
  const out = [];
  const r = streak.lastRecovery;
  if (r && r.recoveredOn === streak.today && streak.status === 'ACTIVE' && !state.celebrated[`r:${r.recoveredOn}`]) {
    out.push({ id: `r:${r.recoveredOn}`, kind: 'recovered', streak: r.streakAtRecovery, missedDays: r.gapDays });
  }
  for (const m of streak.milestones) {
    if (m.status === 'completed' && m.achievedAt === streak.today && !state.celebrated[`m:${m.days}`]) {
      out.push({ id: `m:${m.days}`, kind: 'milestone', days: m.days, name: m.name });
    }
  }
  return out;
}

function rank(map) {
  return Object.entries(map)
    .map(([id, v]) => ({ id, plays: v.plays, seconds: v.seconds }))
    .sort((a, b) => b.plays - a.plays || b.seconds - a.seconds || (a.id < b.id ? -1 : 1));
}

/** Top lagu. range: 'all' | '30d' | '7d'. Perubahan peringkat hanya untuk rentang berjendela. */
export function topTracks(state, { range = 'all', now = Date.now(), tz, limit = 50 } = {}) {
  const zone = tz || state.tz || 'UTC';
  const meta = (id) => {
    const t = state.tracks[id] || {};
    return { id, title: t.t || '', artist: t.a || '', cover: t.c || '', artistId: t.aid || '', last: t.l || 0 };
  };
  if (range === 'all') {
    return Object.entries(state.tracks)
      .filter(([, t]) => t.p > 0)
      .sort(([, a], [, b]) => b.p - a.p || b.s - a.s || b.l - a.l)
      .slice(0, limit)
      .map(([id, t], i) => ({ ...meta(id), rank: i + 1, plays: t.p, seconds: t.s, prevRank: null, change: null }));
  }
  const days = range === '7d' ? 7 : 30;
  const today = dateKey(now, zone);
  const from = addDays(today, -(days - 1));
  const prevFrom = addDays(from, -days);
  const prevTo = addDays(from, -1);
  const cur = {};
  const prev = {};
  for (const h of state.history) {
    if (h.d >= from && h.d <= today) {
      const e = (cur[h.k] ||= { plays: 0, seconds: 0 });
      e.plays += 1;
      e.seconds += h.s;
    } else if (h.d >= prevFrom && h.d <= prevTo) {
      const e = (prev[h.k] ||= { plays: 0, seconds: 0 });
      e.plays += 1;
      e.seconds += h.s;
    }
  }
  const prevRanked = rank(prev);
  const prevPos = new Map(prevRanked.map((r, i) => [r.id, i + 1]));
  const hasPrev = prevRanked.length > 0;
  return rank(cur)
    .slice(0, limit)
    .map((r, i) => {
      const pr = prevPos.get(r.id) ?? null;
      return {
        ...meta(r.id),
        rank: i + 1,
        plays: r.plays,
        seconds: round1(r.seconds),
        prevRank: pr,
        // naik = positif; 'new' = belum ada di jendela sebelumnya (hanya jika jendela sebelumnya punya data)
        change: pr ? pr - (i + 1) : hasPrev ? 'new' : null,
      };
    });
}

/** Riwayat dikelompokkan: Hari ini, Kemarin, Minggu ini, Sebelumnya. */
export function historyGroups(state, { now = Date.now(), tz, query = '' } = {}) {
  const zone = tz || state.tz || 'UTC';
  const today = dateKey(now, zone);
  const yesterday = addDays(today, -1);
  const weekStart = startOfWeekKey(today);
  const q = String(query || '').trim().toLowerCase();
  const groups = [
    { key: 'today', label: 'Hari ini', items: [] },
    { key: 'yesterday', label: 'Kemarin', items: [] },
    { key: 'week', label: 'Minggu ini', items: [] },
    { key: 'earlier', label: 'Sebelumnya', items: [] },
  ];
  for (const h of state.history) {
    const t = state.tracks[h.k] || {};
    if (q && !`${t.t || ''} ${t.a || ''}`.toLowerCase().includes(q)) continue;
    const item = { ...h, title: t.t || '', artist: t.a || '', cover: t.c || '', artistId: t.aid || '' };
    if (h.d === today) groups[0].items.push(item);
    else if (h.d === yesterday) groups[1].items.push(item);
    else if (h.d >= weekStart && h.d < yesterday) groups[2].items.push(item);
    else groups[3].items.push(item);
  }
  return groups.filter((g) => g.items.length);
}

/** Lagu unik yang diputar valid terakhir (untuk "Baru diputar"). */
export function recentTracks(state, limit = 20) {
  const seen = new Set();
  const out = [];
  for (const h of state.history) {
    if (seen.has(h.k)) continue;
    seen.add(h.k);
    const t = state.tracks[h.k] || {};
    out.push({ id: h.k, videoId: h.k, title: t.t || '', artist: t.a || '', cover: t.c || '', artistId: t.aid || '', playedAt: h.t });
    if (out.length >= limit) break;
  }
  return out;
}

export function listeningStats(state, { now = Date.now(), tz, rules = DEFAULT_RULES } = {}) {
  const zone = tz || state.tz || 'UTC';
  const streak = computeStreak(state.daily, { now, tz: zone, rules, unlocked: state.unlocked, meta: state.recovery });
  const artists = new Map();
  let totalPlays = 0;
  let top = null;
  for (const [id, t] of Object.entries(state.tracks)) {
    totalPlays += t.p;
    if (t.p > 0 && (!top || t.p > top.plays || (t.p === top.plays && t.s > top.seconds))) {
      top = { id, title: t.t, artist: t.a, cover: t.c, plays: t.p, seconds: t.s };
    }
    if (t.p > 0 && t.a) {
      const e = artists.get(t.a) || { artist: t.a, plays: 0, seconds: 0 };
      e.plays += t.p;
      e.seconds += t.s;
      artists.set(t.a, e);
    }
  }
  const topArtists = [...artists.values()].sort((a, b) => b.plays - a.plays || b.seconds - a.seconds);
  return {
    totalPlays,
    totalSeconds: streak.totalSeconds,
    activeDays: streak.totalDays,
    listenedDays: Object.values(state.daily).filter((e) => e.s > 0).length,
    uniqueTracks: Object.values(state.tracks).filter((t) => t.p > 0).length,
    topTrack: top,
    topArtist: topArtists[0] || null,
    topArtists: topArtists.slice(0, 10),
    streak,
  };
}

/** Gabungkan state tamu (b) ke state akun (a). Aman diulang (id sesi dedupe). */
export function mergeListening(a, b) {
  const out = normalizeState(a, a?.tz);
  const src = normalizeState(b, b?.tz);
  for (const [d, e] of Object.entries(src.daily)) {
    const cur = out.daily[d] || { s: 0, n: 0, p: 0 };
    out.daily[d] = { s: round1(cur.s + e.s), n: cur.n + e.n, p: cur.p + e.p };
  }
  for (const [k, t] of Object.entries(src.tracks)) {
    const cur = out.tracks[k];
    out.tracks[k] = cur
      ? { ...cur, p: cur.p + t.p, s: round1(cur.s + t.s), l: Math.max(cur.l, t.l), f: Math.min(cur.f || t.f, t.f || cur.f) }
      : t;
  }
  const have = new Set(out.history.map((h) => h.id));
  const added = src.history.filter((h) => !have.has(h.id));
  out.history = [...out.history, ...added].sort((x, y) => y.t - x.t).slice(0, HISTORY_LIMIT);
  out.seen = [...new Set([...out.seen, ...src.seen])].slice(-SEEN_LIMIT);
  for (const [days, v] of Object.entries(src.unlocked)) {
    if (!out.unlocked[days] || v < out.unlocked[days]) out.unlocked[days] = v;
  }
  for (const [id, v] of Object.entries(src.celebrated)) out.celebrated[id] ||= v;
  out.lastPlayAt = Math.max(out.lastPlayAt || 0, src.lastPlayAt || 0);
  out.updatedAt = Math.max(out.updatedAt, src.updatedAt);
  return out;
}
