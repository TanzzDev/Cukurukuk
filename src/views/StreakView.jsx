import React, { useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNav } from '../context/NavContext';
import { deviceTz, useNow, useStreak } from '../services/listening';
import { dayDetail, monthGrid } from '../../shared/streak.js';
import { fmtCountdown, fmtDateKey, fmtInstant, fmtMinutes, MONTHS_ID, statusCopy } from '../lib/format';
import useCountUp from '../hooks/useCountUp';
import StreakFlame from '../components/streak/StreakFlame';
import StreakBadge from '../components/streak/StreakBadge';
import AchievementBadge from '../components/streak/AchievementBadge';
import { IconButton, PrimaryButton, Sheet, cn } from '../components/ui';

const Section = ({ title, hint, children }) => (
  <section className="mt-8 px-4 md:px-0" aria-label={title}>
    <h2 className="font-display text-[17px] font-semibold">{title}</h2>
    {hint && <p className="mt-1 text-[13px] text-fg/50">{hint}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

function Countdown({ expiresAt }) {
  const now = useNow(1000);
  return <span className="tabular-nums">{fmtCountdown(expiresAt - now)}</span>;
}

function Recovery({ streak }) {
  if (streak.status === 'DORMANT' && streak.recovery) {
    const r = streak.recovery;
    return (
      <div className="mx-4 mt-6 rounded-3xl border border-amber-400/30 bg-amber-400/[0.07] p-5 md:mx-0" role="region" aria-label="Masa pemulihan">
        <StreakBadge status="DORMANT" />
        <h3 className="mt-3 font-display text-xl font-semibold">Streak {r.previousStreak} Hari</h3>
        <p className="mt-1 text-[15px]">Api sedang padam.</p>
        <p className="text-[15px] text-fg/70">Pulihkan dengan mendengarkan satu lagu valid.</p>
        <div className="mt-4 rounded-2xl bg-bg/50 p-4">
          <div className="text-[13px] text-fg/55">Kesempatan pemulihan tersisa</div>
          <div className="font-display text-3xl font-semibold text-amber-400">{r.daysLeft} hari</div>
          <div className="mt-1 text-sm text-fg/70">Hangus dalam <Countdown expiresAt={r.expiresAt} /></div>
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-fg/55">
          Masa pemulihan 7 hari dimulai {fmtInstant(r.startedAt, r.tz)}. Terakhir dapat dipulihkan {fmtDateKey(r.lastRecoverable)} pukul 23:59; streak hangus permanen pada {fmtInstant(r.expiresAt, r.tz)}. Saat dipulihkan, streak lama dilanjutkan (tidak kembali ke 1).
        </p>
      </div>
    );
  }
  if (streak.status === 'EXPIRED') {
    const last = streak.closedChains[streak.closedChains.length - 1];
    return (
      <div className="mx-4 mt-6 rounded-3xl border border-red-400/25 bg-red-400/[0.06] p-5 md:mx-0" role="region" aria-label="Streak berakhir">
        <StreakBadge status="EXPIRED" />
        <h3 className="mt-3 font-display text-xl font-semibold">Streak kamu telah berakhir.</h3>
        {last && <p className="mt-1 text-sm text-fg/65">Streak {last.length} hari berakhir pada {fmtDateKey(last.expiredOn)}. Rekor tertinggimu tetap {streak.best} hari.</p>}
        <p className="mt-2 text-[15px]">Dengarkan lagu hari ini untuk memulai perjalanan streak baru!</p>
      </div>
    );
  }
  return null;
}

function Journey({ streak, onPick }) {
  const ms = streak.milestones;
  const ROW = 78;
  const N = ms.length;
  const pts = ms.map((_, i) => ({ x: 36 + 15 * Math.sin(i * 1.15), y: 40 + i * ROW }));
  const d = pts.reduce((a, p, i) => (i === 0 ? `M${p.x} ${p.y}` : `${a} C ${pts[i - 1].x} ${(pts[i - 1].y + p.y) / 2}, ${p.x} ${(pts[i - 1].y + p.y) / 2}, ${p.x} ${p.y}`), '');
  const k = ms.reduce((acc, m, i) => (m.status === 'completed' ? i : acc), -1);
  const prog = streak.progress.complete ? 0 : (streak.progress.percent || 0) / 100;
  const frac = k >= N - 1 ? 1 : Math.min(1, Math.max(0, (Math.max(k, 0) + (streak.status === 'ACTIVE' || streak.status === 'DORMANT' ? prog : 0)) / (N - 1)));
  const dim = streak.status !== 'ACTIVE';
  return (
    <div className="relative" style={{ height: N * ROW }}>
      <svg className="absolute left-0 top-0" width="72" height={N * ROW} aria-hidden="true">
        <defs><linearGradient id="jr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffb02e" /><stop offset="1" stopColor="#ff5a00" /></linearGradient></defs>
        <path d={d} fill="none" stroke="rgb(var(--fg-rgb) / .14)" strokeWidth="3" strokeLinecap="round" />
        <path d={d} fill="none" stroke={dim ? 'rgb(var(--fg-rgb) / .4)' : 'url(#jr)'} strokeWidth="3.5" strokeLinecap="round" pathLength="1" strokeDasharray={`${frac} 1`} />
        {pts.map((p, i) => {
          const m = ms[i];
          const done = m.status === 'completed';
          return (
            <g key={m.days}>
              <circle cx={p.x} cy={p.y} r="11" fill={done ? (dim ? 'rgb(var(--fg-rgb) / .55)' : '#ff7a1a') : 'rgb(var(--bg-rgb))'} stroke={done ? 'none' : m.status === 'in_progress' ? '#ffb02e' : 'rgb(var(--fg-rgb) / .22)'} strokeWidth="2.5" />
              {done && <path d={`M${p.x - 4.5} ${p.y} l3.2 3.4 l6 -6.6`} fill="none" stroke="#1a0a00" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
              {m.status === 'in_progress' && <circle cx={p.x} cy={p.y} r="4" fill="#ffb02e" />}
            </g>
          );
        })}
      </svg>
      {ms.map((m, i) => (
        <button key={m.days} type="button" onClick={() => onPick(m)} style={{ top: i * ROW, height: ROW }} aria-label={`${m.days} hari: ${m.status === 'completed' ? 'selesai' : m.status === 'in_progress' ? 'sedang berjalan' : 'terkunci'}`}
          className="press focus-ring absolute inset-x-0 flex items-center gap-3 rounded-2xl pl-[78px] pr-2 text-left hover:bg-fg/[0.04]">
          <div className="min-w-0 flex-1">
            <div className={cn('font-display text-[15px] font-semibold', m.status === 'locked' && 'text-fg/45')}>{m.days} Hari <span className="ml-1 text-[12px] font-medium text-fg/45">{m.name}</span></div>
            <div className="mt-0.5 text-[12.5px] text-fg/55">
              {m.status === 'completed' ? `Selesai • ${fmtDateKey(m.achievedAt)}` : m.status === 'in_progress' ? `Sedang berjalan • ${streak.current}/${m.days} hari` : `Terkunci • target ${m.days} hari`}
            </div>
          </div>
          <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold tracking-wider', m.status === 'completed' ? 'bg-emerald-400/15 text-emerald-400' : m.status === 'in_progress' ? 'bg-amber-400/15 text-amber-400' : 'bg-fg/[0.07] text-fg/45')}>
            {m.status === 'completed' ? 'COMPLETED' : m.status === 'in_progress' ? 'IN PROGRESS' : 'LOCKED'}
          </span>
        </button>
      ))}
    </div>
  );
}

const STATUS_LABEL = { active: 'Hari aktif', recovered: 'Api dinyalakan kembali', recovery: 'Masa pemulihan', missed: 'Hari terlewat', expired: 'Masa pemulihan berakhir (hangus)', partial: 'Belum memenuhi syarat', none: 'Tidak ada aktivitas', future: 'Belum terjadi' };

function Calendar({ state, streak }) {
  const [ym, setYm] = useState(streak.today.slice(0, 7));
  const [selKey, setSelKey] = useState(streak.today);
  const [y, m] = ym.split('-').map(Number);
  const cells = useMemo(() => monthGrid(state.daily, y, m, { rules: streak.rules, today: streak.today, streak }), [state.daily, y, m, streak]);
  const shift = (n) => { const dt = new Date(Date.UTC(y, m - 1 + n, 1)); setYm(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`); };
  const det = dayDetail(state.daily, selKey, { rules: streak.rules, today: streak.today, streak });
  const cls = { active: 'cal-active', recovered: 'cal-recovered', recovery: 'cal-recovery', missed: 'cal-missed', expired: 'cal-expired', partial: 'cal-partial', none: 'bg-fg/[0.04] text-fg/50', future: 'bg-fg/[0.03] text-fg/30' };
  return (
    <div className="rounded-3xl border border-fg/10 bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <IconButton label="Bulan sebelumnya" onClick={() => shift(-1)}><ChevronLeft size={20} /></IconButton>
        <div className="font-display text-[15px] font-semibold">{MONTHS_ID[m - 1]} {y}</div>
        <IconButton label="Bulan berikutnya" onClick={() => shift(1)} disabled={ym >= streak.today.slice(0, 7)}><ChevronRight size={20} /></IconButton>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium text-fg/40">{['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((d) => <div key={d}>{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((c, i) => c ? (
          <button key={c.key} type="button" onClick={() => setSelKey(c.key)} aria-label={`${fmtDateKey(c.key)}: ${STATUS_LABEL[c.status]}`} aria-pressed={selKey === c.key}
            className={cn('press focus-ring relative aspect-square rounded-xl text-[13px] font-semibold', cls[c.status], c.isToday && 'ring-2 ring-fg', selKey === c.key && 'outline outline-2 outline-offset-1 outline-fg/60')}>
            {c.day}
          </button>
        ) : <div key={`e${i}`} />)}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11.5px] text-fg/55">
        {[['cal-active', 'Aktif'], ['cal-recovered', 'Dipulihkan'], ['cal-recovery', 'Masa pemulihan'], ['cal-missed', 'Terlewat'], ['cal-expired', 'Hangus']].map(([c, l]) => <span key={l} className="flex items-center gap-1.5"><i className={cn('h-3 w-3 rounded', c)} />{l}</span>)}
      </div>
      <div className="mt-4 rounded-2xl bg-fg/[0.05] p-4 text-sm" aria-live="polite">
        <div className="font-semibold">{fmtDateKey(det.key, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
        <div className="mt-0.5 text-fg/60">{STATUS_LABEL[det.status]}</div>
        <dl className="mt-3 grid grid-cols-3 gap-3 text-[13px]">
          <div><dt className="text-fg/45">Durasi dengar</dt><dd className="font-semibold">{det.sec ? fmtMinutes(det.sec) : '–'}</dd></div>
          <div><dt className="text-fg/45">Sesi putar</dt><dd className="font-semibold">{det.sessions || '–'}</dd></div>
          <div><dt className="text-fg/45">Pemutaran valid</dt><dd className="font-semibold">{det.plays || '–'}</dd></div>
        </dl>
        <div className="mt-3 text-[13px] text-fg/65">Kualifikasi streak: {det.qualified ? 'memenuhi syarat' : det.isFuture ? '–' : `belum${det.playsNeeded ? ` (butuh ${det.playsNeeded} pemutaran valid lagi)` : ''}`}</div>
      </div>
    </div>
  );
}

function History({ streak }) {
  const rows = [...streak.chains].reverse();
  if (!rows.length) return <p className="rounded-2xl bg-fg/[0.04] p-5 text-sm text-fg/55">Belum ada riwayat streak. Dengarkan satu lagu untuk memulai.</p>;
  return (
    <div className="space-y-2.5">
      <div className="rounded-2xl bg-fg/[0.05] p-4 text-sm">Rekor tertinggi: <b>{streak.best} hari</b>{streak.bestStart && <span className="text-fg/55"> ({fmtDateKey(streak.bestStart)} – {fmtDateKey(streak.bestEnd)})</span>}</div>
      {rows.map((c) => (
        <div key={c.start} className="rounded-2xl border border-fg/10 bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="font-display text-[15px] font-semibold">{c.length} hari</div>
            <StreakBadge status={c.endedBy === 'ongoing' ? 'ACTIVE' : c.endedBy === 'dormant' ? 'DORMANT' : 'EXPIRED'} />
          </div>
          <div className="mt-1 text-[13px] text-fg/55">{fmtDateKey(c.start)} – {fmtDateKey(c.last)}{c.endedBy === 'expired' && ` • hangus ${fmtDateKey(c.expiredOn)}`}</div>
          {c.recoveries.map((r) => (
            <div key={r.recoveredOn} className="mt-2 rounded-xl bg-amber-400/[0.08] px-3 py-2 text-[12.5px] text-fg/70">Pulih {fmtDateKey(r.recoveredOn)} setelah {r.gapDays} hari terlewat (streak {r.streakAtRecovery} dipertahankan)</div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function StreakView() {
  const { back } = useNav();
  const { state, streak } = useStreak(60000);
  const [pick, setPick] = useState(null);
  const copy = statusCopy(streak);
  const num = useCountUp(streak.current, 1100);
  const p = streak.progress;
  const avg = streak.totalDays ? Math.round(streak.totalSeconds / streak.totalDays / 60) : 0;
  return (
    <div className="pb-6">
      <header className="sticky top-0 z-20 flex items-center gap-2 bg-bg/80 px-3 py-3 backdrop-blur md:px-0 pt-safe">
        <IconButton label="Kembali" onClick={() => back('profile')}><ArrowLeft size={21} /></IconButton>
        <h1 className="font-display text-lg font-semibold">Drowify Streak</h1>
      </header>

      <section className="relative mt-2 px-4 md:px-0" aria-label="Ringkasan streak">
        <div className="relative overflow-hidden rounded-[32px] border border-fg/10 bg-card px-5 pb-6 pt-8 md:flex md:items-center md:gap-10 md:px-10">
          {streak.status === 'ACTIVE' && <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 bg-[radial-gradient(closest-side,rgba(255,122,26,.24),transparent)] md:left-24 md:translate-x-0" aria-hidden="true" />}
          <div className="relative mx-auto flex shrink-0 justify-center md:mx-0"><StreakFlame status={streak.status} days={streak.current} size={168} burst={streak.status === 'ACTIVE'} /></div>
          <div className="relative mt-3 text-center md:mt-0 md:flex-1 md:text-left">
            <StreakBadge status={streak.status} />
            <div className="mt-3 flex items-baseline justify-center gap-2 md:justify-start" aria-label={`${streak.current} hari`}>
              <span className="font-display text-[68px] font-semibold leading-none tabular-nums md:text-[84px]">{num}</span>
              <span className="text-lg font-medium text-fg/60">hari</span>
            </div>
            <h2 className="mt-2 font-display text-[17px] font-semibold">{copy.title}</h2>
            <p className="mt-1 text-sm text-fg/60">{copy.text}</p>
            <div className="mt-5 grid grid-cols-3 gap-2 text-left">
              {[['Rekor', `${streak.best} hari`], ['Total hari', `${streak.totalDays} hari`], ['Terakhir', streak.lastActive ? fmtDateKey(streak.lastActive, { day: 'numeric', month: 'short' }) : '–']].map(([a, b]) => (
                <div key={a} className="rounded-2xl bg-fg/[0.06] px-3 py-2.5"><div className="text-[11px] text-fg/50">{a}</div><div className="text-[14px] font-semibold">{b}</div></div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-fg/[0.06] px-3 py-2.5 text-[13px]">
              <span className={cn('grid h-5 w-5 place-items-center rounded-full', streak.todayQualified ? 'bg-emerald-400 text-black' : 'border border-fg/30')}>{streak.todayQualified && <Check size={13} />}</span>
              {streak.todayQualified ? 'Hari ini sudah terhitung' : `Hari ini belum: dengarkan ${streak.playsNeededToday > 1 ? `${streak.playsNeededToday} lagu valid` : 'satu lagu valid'}`}
            </div>
          </div>
        </div>
      </section>

      <Recovery streak={streak} />

      <Section title="Progres milestone">
        <div className="rounded-3xl border border-fg/10 bg-card p-5">
          {p.complete ? (
            <p className="text-sm">Semua milestone sampai 999 hari tercapai. Streak terus dihitung: <b>{streak.current} hari</b>.</p>
          ) : (
            <>
              <div className="flex items-baseline justify-between"><span className="text-[13px] text-fg/55">Milestone terakhir</span><b className="font-display">{p.from || 0} hari</b></div>
              <div className="mt-1 flex items-baseline justify-between"><span className="text-[13px] text-fg/55">Target berikutnya</span><b className="font-display">{p.to} hari</b></div>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-fg/10" role="progressbar" aria-valuenow={p.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progres menuju milestone berikutnya">
                <div className="h-full rounded-full bg-gradient-to-r from-[#ff6a00] to-[#ffb02e] transition-[width] duration-700" style={{ width: `${Math.max(2, p.percent)}%`, opacity: streak.status === 'ACTIVE' ? 1 : 0.45 }} />
              </div>
              <div className="mt-2 flex justify-between text-[12.5px] text-fg/60"><span>{p.done} / {p.total} hari</span><span>{p.percent}% selesai</span><span>sisa {p.remaining} hari</span></div>
            </>
          )}
        </div>
      </Section>

      <Section title="Perjalanan sampai 999 hari" hint="Ketuk milestone untuk melihat detailnya."><Journey streak={streak} onPick={setPick} /></Section>
      <Section title="Kalender aktivitas"><Calendar state={state} streak={streak} /></Section>
      <Section title="Riwayat streak"><History streak={streak} /></Section>

      <Section title="Achievement" hint={`${streak.completedCount} dari ${streak.milestones.length} terbuka`}>
        <div className="grid grid-cols-4 gap-1 sm:grid-cols-5 md:grid-cols-7">
          {streak.milestones.map((m) => <AchievementBadge key={m.days} milestone={m} onClick={() => setPick(m)} />)}
        </div>
      </Section>

      <Section title="Statistik">
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
          {[['Total hari mendengarkan', `${streak.totalDays}`], ['Total waktu mendengarkan', fmtMinutes(streak.totalSeconds)], ['Pemutaran valid', `${streak.totalPlays}`], ['Rata-rata per hari aktif', `${avg} menit`], ['Streak terpanjang', `${streak.best} hari`], ['Pemulihan api', `${streak.recoveries.length}x`]].map(([a, b]) => (
            <div key={a} className="rounded-2xl border border-fg/10 bg-card p-4"><div className="text-[12px] text-fg/50">{a}</div><div className="mt-1 font-display text-[17px] font-semibold">{b}</div></div>
          ))}
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-fg/40">Aturan: hari dihitung aktif bila ada {streak.rules.minPlays} pemutaran valid (dengar nyata ≥ 30 detik atau separuh lagu). Zona waktu perangkat: {deviceTz()}.</p>
      </Section>

      <Sheet open={!!pick} onClose={() => setPick(null)} title={pick ? `${pick.days} Hari` : ''} z={210}>
        {pick && (
          <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+22px)] text-center">
            <div className="mx-auto w-fit"><AchievementBadge milestone={pick} size={110} /></div>
            <h3 className="mt-2 font-display text-lg font-semibold">{pick.name}</h3>
            <p className="mt-1 text-sm text-fg/60">{pick.description}</p>
            <dl className="mt-5 grid grid-cols-2 gap-2.5 text-left text-[13px]">
              <div className="rounded-2xl bg-fg/[0.06] p-3"><dt className="text-fg/50">Status</dt><dd className="font-semibold">{pick.status === 'completed' ? 'Completed' : pick.status === 'in_progress' ? 'In Progress' : 'Locked'}</dd></div>
              <div className="rounded-2xl bg-fg/[0.06] p-3"><dt className="text-fg/50">Jumlah hari</dt><dd className="font-semibold">{pick.days} hari</dd></div>
              {pick.status === 'completed' ? (
                <div className="col-span-2 rounded-2xl bg-fg/[0.06] p-3"><dt className="text-fg/50">Tanggal berhasil</dt><dd className="font-semibold">{fmtDateKey(pick.achievedAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</dd></div>
              ) : (
                <>
                  <div className="rounded-2xl bg-fg/[0.06] p-3"><dt className="text-fg/50">Progres saat ini</dt><dd className="font-semibold">{streak.current} / {pick.days} hari</dd></div>
                  <div className="rounded-2xl bg-fg/[0.06] p-3"><dt className="text-fg/50">Sisa hari</dt><dd className="font-semibold">{pick.remaining} hari</dd></div>
                </>
              )}
            </dl>
            <PrimaryButton className="mt-5 w-full" onClick={() => setPick(null)}>Tutup</PrimaryButton>
          </div>
        )}
      </Sheet>
    </div>
  );
}
