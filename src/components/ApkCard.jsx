import React, { useEffect, useState } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { PrimaryButton } from './ui';

const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Unduh APK resmi: hanya aktif bila public/apk/release.json menunjuk berkas yang benar-benar ada. */
export default function ApkCard() {
  const [rel, setRel] = useState(undefined);
  useEffect(() => {
    let alive = true;
    fetch('/apk/release.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((j) => alive && setRel(j)).catch(() => alive && setRel(null));
    return () => { alive = false; };
  }, []);
  const ok = rel && rel.available && rel.url && rel.version;
  return (
    <div className="rounded-3xl border border-fg/10 bg-card p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-fg text-bg"><Smartphone size={22} /></span>
        <div className="min-w-0"><div className="font-display text-[15px] font-semibold">Drowify Music untuk Android</div><div className="text-[12.5px] text-fg/55">{ok ? `Versi ${rel.version}${rel.sizeBytes ? ` • ${fmtSize(rel.sizeBytes)}` : ''}` : 'Aplikasi Android (APK)'}</div></div>
      </div>
      {ok ? (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-2.5 text-[12.5px]">
            <div className="rounded-xl bg-fg/[0.06] p-3"><dt className="text-fg/50">Kompatibilitas</dt><dd className="font-medium">{rel.minAndroid}</dd></div>
            <div className="rounded-xl bg-fg/[0.06] p-3"><dt className="text-fg/50">Dirilis</dt><dd className="font-medium">{rel.releasedAt || '–'}</dd></div>
          </dl>
          {rel.changelog?.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px] text-fg/65">{rel.changelog.map((c) => <li key={c}>{c}</li>)}</ul>}
          <a href={rel.url} download className="mt-4 block"><PrimaryButton className="w-full" tabIndex={-1}><Download size={17} /> Download APK</PrimaryButton></a>
          {rel.sha256 && <p className="mt-2 break-all text-[11px] text-fg/35">SHA-256: {rel.sha256}</p>}
        </>
      ) : (
        <p className="mt-4 rounded-xl bg-fg/[0.06] p-3 text-[13px] text-fg/60">{rel === undefined ? 'Memeriksa ketersediaan…' : 'APK belum tersedia. Versi web dapat dipasang lewat menu “Tambahkan ke layar utama” di browser.'}</p>
      )}
    </div>
  );
}
