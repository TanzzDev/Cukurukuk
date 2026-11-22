import { addDays, dateKey, daysInMonth, diffDays, isDateKey, startOfDayMs, weekday } from './dates.js';
import {
  DEFAULT_RULES, MILESTONES, milestoneDescription, milestoneName, milestoneTier,
} from './config.js';

export const STREAK_STATUS = Object.freeze({ ACTIVE: 'ACTIVE', DORMANT: 'DORMANT', EXPIRED: 'EXPIRED', NEW: 'NEW' });

export function normalizeRules(r = {}) {
  return {
    minPlays: Math.max(1, Math.floor(Number(r.minPlays) || DEFAULT_RULES.minPlays)),
    minSeconds: Math.max(0, Math.floor(Number(r.minSeconds) || 0)),
    recoveryDays: Math.max(1, Math.floor(Number(r.recoveryDays) || DEFAULT_RULES.recoveryDays)),
  };
}

/** Satu hari dihitung aktif bila pemutaran VALID >= minPlays (dan detik valid >= minSeconds bila disetel). */
export function qualifies(entry, rules = DEFAULT_RULES) {
  if (!entry) return false;
  const r = normalizeRules(rules);
  return (Number(entry.p) || 0) >= r.minPlays && (Number(entry.s) || 0) >= r.minSeconds;
}

/**
 * Hitung seluruh keadaan Streak dari `daily` ({ 'YYYY-MM-DD': { s, n, p } }). Murni & deterministik.
 *
 * ATURAN (semua tanggal = hari kalender lokal pengguna):
 *  • L = hari aktif terakhir, T = hari ini.
 *  • T - L <= 1  → ACTIVE (T - L = 1 berarti "belum mendengarkan hari ini", hari belum berakhir).
 *  • Hari pertama yang terlewat M = L + 1. Masa pemulihan = 7 hari kalender INKLUSIF mulai M: M … M+6.
 *    Hari terakhir yang masih bisa dipulihkan = L + 7 (sampai 23:59:59.999 waktu lokal).
 *    2 <= T - L <= 7 → DORMANT (api padam, angka streak lama dipertahankan).
 *  • T - L >= 8 → EXPIRED: streak hangus permanen. Hangus tepat pada 00:00 hari L + 8.
 *  • Hari aktif berikutnya R: R - L = 1 → streak +1; 2 <= R - L <= 7 → DIPULIHKAN (nilai streak lama
 *    dipertahankan, TIDAK menjadi 1 dan TIDAK bertambah pada hari pemulihan; hari aktif berikutnya melanjutkan);
 *    R - L >= 8 → rantai lama hangus, rantai baru mulai dari 1.
 *  • Rekor tertinggi = rantai terpanjang yang pernah ada; tidak pernah dihapus.
 * Status DORMANT/EXPIRED selalu dapat dihitung ulang dari data harian; `meta` (opsional) hanya
 * mengunci instan awal/akhir masa pemulihan agar tidak bergeser saat zona waktu berubah.
 */
export function computeStreak(daily = {}, opts = {}) {
  const { now = Date.now(), tz = 'UTC', unlocked = {}, meta = null } = opts;
  const rules = normalizeRules(opts.rules);
  const today = dateKey(now, tz);

  const keys = Object.keys(daily).filter(isDateKey).sort();
  const active = [];
  let totalSeconds = 0;
  let totalPlays = 0;
  let lastListened = null;
  for (const k of keys) {
    const e = daily[k];
    const s = Number(e?.s) || 0;
    const p = Number(e?.p) || 0;
    totalSeconds += s;
    totalPlays += p;
    if (s > 0 || p > 0) lastListened = k;
    if (qualifies(e, rules)) active.push(k);
  }

  const reached = {};
  const reach = (len, day) => {
    for (const m of MILESTONES) if (len >= m && !(m in reached)) reached[m] = day;
  };
  const expiredOn = (last) => addDays(last, rules.recoveryDays + 1);
  const chains = [];
  const recoveries = [];
  let cur = null;
  for (const d of active) {
    if (!cur) {
      cur = { start: d, last: d, length: 1, recoveries: [] };
      reach(1, d);
      continue;
    }
    const gap = diffDays(cur.last, d);
    if (gap <= 1) {
      cur.length += 1;
      cur.last = d;
      reach(cur.length, d);
    } else if (gap <= rules.recoveryDays) {
      const rec = {
        missedFrom: addDays(cur.last, 1),
        missedTo: addDays(d, -1),
        recoveredOn: d,
        gapDays: gap - 1,
        streakAtRecovery: cur.length,
      };
      cur.recoveries.push(rec);
      recoveries.push(rec);
      cur.last = d;
    } else {
      chains.push({ ...cur, endedBy: 'expired', expiredOn: expiredOn(cur.last) });
      cur = { start: d, last: d, length: 1, recoveries: [] };
      reach(1, d);
    }
  }

  let status = STREAK_STATUS.NEW;
  let current = 0;
  let currentStart = null;
  let needsToday = false;
  let recovery = null;
  let ongoing = null;
  if (cur) {
    const gap = diffDays(cur.last, today);
    const usable = meta && meta.forLast === cur.last && Number.isFinite(meta.startedAt) && Number.isFinite(meta.expiresAt);
    let st;
    if (usable) st = now < meta.expiresAt ? STREAK_STATUS.DORMANT : STREAK_STATUS.EXPIRED; // instan tersimpan menang
    else if (gap <= 1) st = STREAK_STATUS.ACTIVE;
    else if (gap <= rules.recoveryDays) st = STREAK_STATUS.DORMANT;
    else st = STREAK_STATUS.EXPIRED;

    if (st === STREAK_STATUS.ACTIVE) {
      status = st;
      current = cur.length;
      currentStart = cur.start;
      needsToday = gap === 1;
      ongoing = { ...cur, endedBy: 'ongoing' };
    } else if (st === STREAK_STATUS.DORMANT) {
      status = st;
      current = cur.length;
      currentStart = cur.start;
      ongoing = { ...cur, endedBy: 'dormant' };
      const mtz = usable && meta.tz ? meta.tz : tz;
      const lastRecoverable = addDays(cur.last, rules.recoveryDays);
      recovery = {
        forLast: cur.last,
        tz: mtz,
        missedFrom: addDays(cur.last, 1),
        lastRecoverable,
        startedAt: usable ? meta.startedAt : startOfDayMs(addDays(cur.last, 1), tz),
        expiresAt: usable ? meta.expiresAt : startOfDayMs(expiredOn(cur.last), tz),
        previousStreak: cur.length,
      };
      recovery.msLeft = Math.max(0, recovery.expiresAt - now);
      recovery.daysLeft = Math.max(1, diffDays(dateKey(now, mtz), lastRecoverable) + 1);
    } else {
      status = STREAK_STATUS.EXPIRED;
      chains.push({ ...cur, endedBy: 'expired', expiredOn: expiredOn(cur.last) });
    }
  } else if (chains.length) status = STREAK_STATUS.EXPIRED;

  const all = ongoing ? [...chains, ongoing] : chains.slice();
  let best = 0;
  let bestStart = null;
  let bestEnd = null;
  for (const c of all) {
    if (c.length > best) {
      best = c.length;
      bestStart = c.start;
      bestEnd = c.last;
    }
  }

  const milestones = [];
  let openAssigned = false;
  for (const days of MILESTONES) {
    const derived = reached[days] || null;
    const stored = isDateKey(unlocked[days]) ? unlocked[days] : null;
    const achievedAt = derived && stored ? (derived < stored ? derived : stored) : derived || stored;
    const completed = !!achievedAt;
    let st = 'locked';
    if (completed) st = 'completed';
    else if (!openAssigned) {
      st = 'in_progress';
      openAssigned = true;
    }
    milestones.push({
      days,
      name: milestoneName(days),
      tier: milestoneTier(days),
      description: milestoneDescription(days),
      status: st,
      achievedAt: achievedAt || null,
      progress: completed ? 1 : Math.min(1, current / days),
      remaining: completed ? 0 : Math.max(0, days - current),
    });
  }

  let lastMilestone = 0;
  let nextMilestone = null;
  for (const m of MILESTONES) {
    if (m <= current) lastMilestone = m;
    else {
      nextMilestone = m;
      break;
    }
  }
  const progress = nextMilestone
    ? {
        from: lastMilestone,
        to: nextMilestone,
        done: current - lastMilestone,
        total: nextMilestone - lastMilestone,
        remaining: nextMilestone - current,
        percent: Math.floor(((current - lastMilestone) / (nextMilestone - lastMilestone)) * 100),
        complete: false,
      }
    : { from: lastMilestone, to: null, done: current - lastMilestone, total: 0, remaining: 0, percent: 100, complete: true };

  const todayE = daily[today];
  const todayPlays = Number(todayE?.p) || 0;
  const todaySec = Number(todayE?.s) || 0;
  return {
    today,
    rules,
    status,
    current,
    currentStart,
    needsToday,
    best,
    bestStart,
    bestEnd,
    todayQualified: qualifies(todayE, rules),
    todayPlays,
    todaySec,
    playsNeededToday: Math.max(0, rules.minPlays - todayPlays),
    lastActive: active.length ? active[active.length - 1] : null,
    lastListened,
    totalDays: active.length,
    totalSeconds,
    totalPlays,
    recovery,
    chains: all,
    closedChains: chains,
    recoveries,
    lastRecovery: recoveries.length ? recoveries[recoveries.length - 1] : null,
    milestones,
    completedCount: milestones.filter((m) => m.status === 'completed').length,
    lastMilestone,
    nextMilestone,
    progress,
  };
}

/** Rekaman streak ala "tabel database" (nama kolom sesuai spesifikasi). */
export function streakRecord(streak, { userId = null, lastPlayAt = 0, updatedAt = Date.now() } = {}) {
  const iso = (ms) => (Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null);
  return {
    user_id: userId,
    current_streak: streak.status === STREAK_STATUS.EXPIRED || streak.status === STREAK_STATUS.NEW ? 0 : streak.current,
    longest_streak: streak.best,
    last_valid_play_at: iso(lastPlayAt),
    last_active_date: streak.lastActive,
    streak_status: streak.status,
    recovery_started_at: streak.recovery ? iso(streak.recovery.startedAt) : null,
    recovery_expires_at: streak.recovery ? iso(streak.recovery.expiresAt) : null,
    streak_started_at: streak.currentStart,
    updated_at: iso(updatedAt),
  };
}

const pad2 = (n) => String(n).padStart(2, '0');

function daySets(streak) {
  const recovered = new Set();
  const missed = new Set();
  const expired = [];
  for (const c of streak.chains) {
    for (const r of c.recoveries || []) {
      recovered.add(r.recoveredOn);
      for (let k = r.missedFrom; k <= r.missedTo; k = addDays(k, 1)) missed.add(k);
    }
    if (c.endedBy === 'expired') expired.push({ from: addDays(c.last, 1), to: addDays(c.expiredOn, -1) });
  }
  const open = streak.recovery ? { from: streak.recovery.missedFrom, to: streak.recovery.lastRecoverable } : null;
  return { recovered, missed, expired, open };
}

/**
 * Status tiap hari: active | recovered | recovery | missed | expired | partial | none | future
 *  recovered = hari yang menyalakan kembali api; recovery = hari dalam masa pemulihan yang sedang berjalan;
 *  missed = hari terlewat pada celah yang kemudian dipulihkan; expired = masa pemulihan yang berakhir hangus.
 */
export function dayStatus(key, daily, { rules = DEFAULT_RULES, today = null, sets = null } = {}) {
  const e = daily[key];
  const plays = Number(e?.p) || 0;
  const sec = Number(e?.s) || 0;
  const isFuture = today ? key > today : false;
  let status = 'none';
  if (qualifies(e, rules) && !isFuture) status = sets?.recovered.has(key) ? 'recovered' : 'active';
  else if (sets?.open && key >= sets.open.from && key <= sets.open.to) status = 'recovery';
  else if (isFuture) status = 'future';
  else if (sets?.missed.has(key)) status = 'missed';
  else if (sets?.expired.some((w) => key >= w.from && key <= w.to)) status = 'expired';
  else if (plays > 0 || sec > 0) status = 'partial';
  return { status, plays, sec, sessions: Number(e?.n) || 0, isFuture };
}

/** Sel kalender sebulan (awal pekan = Senin). `null` = sel kosong sebelum tanggal 1. */
export function monthGrid(daily, year, month, { rules = DEFAULT_RULES, today = null, streak = null } = {}) {
  const sets = streak ? daySets(streak) : null;
  const r = normalizeRules(rules);
  const first = `${year}-${pad2(month)}-01`;
  const lead = (weekday(first) + 6) % 7;
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  const total = daysInMonth(year, month);
  for (let d = 1; d <= total; d++) {
    const key = `${year}-${pad2(month)}-${pad2(d)}`;
    const st = dayStatus(key, daily, { rules: r, today, sets });
    const qualified = st.status === 'active' || st.status === 'recovered';
    const level = !qualified ? (st.plays > 0 || st.sec > 0 ? 1 : 0) : st.plays >= r.minPlays * 4 ? 4 : st.plays >= r.minPlays * 2 ? 3 : 2;
    cells.push({ key, day: d, ...st, level, isToday: key === today });
  }
  return cells;
}

/** Detail satu tanggal untuk panel kalender. */
export function dayDetail(daily, key, { rules = DEFAULT_RULES, today = null, streak = null } = {}) {
  const r = normalizeRules(rules);
  const st = dayStatus(key, daily, { rules: r, today, sets: streak ? daySets(streak) : null });
  return { key, ...st, qualified: st.status === 'active' || st.status === 'recovered', playsNeeded: Math.max(0, r.minPlays - st.plays) };
}
