import CryptoJS from 'crypto-js';

const CANDIDATE_KEYS = [
  '4c9b7d2e'.repeat(3) + '4c9b7d21',
  '4c9b7d2e'.repeat(3) + '4c9b7d2e',
  'rz18efAXUbdiaO7k'
];

let cachedAuth = '4c9b7d21';
let lastAuthCheck = 0;

async function scrapeFreshAuth() {
  if (Date.now() - lastAuthCheck < 15 * 60 * 1000 && cachedAuth) {
    return cachedAuth;
  }
  try {
    const htmlRes = await fetch('https://vidssave.com/', { cache: 'no-store' });
    const html = await htmlRes.text();
    const matches = html.match(/src="([^"]*chunk[^"]*\.js)"/g) || [];
    for (const m of matches) {
      const scriptUrl = m.replace(/^src="/, '').replace(/"$/, '');
      const fullUrl = scriptUrl.startsWith('http') ? scriptUrl : 'https://vidssave.com' + scriptUrl;
      const scriptRes = await fetch(fullUrl);
      const text = await scriptRes.text();
      const authMatch = text.match(/auth:"([a-zA-Z0-9_-]{6,32})"/);
      if (authMatch) {
        cachedAuth = authMatch[1];
        lastAuthCheck = Date.now();
        return cachedAuth;
      }
    }
  } catch (e) {
    console.warn('[ClientExtractor] Failed to scrape fresh auth:', e);
  }
  return cachedAuth;
}

function decryptPayload(cipherB64) {
  const dynamicKeys = [
    '4c9b7d2e'.repeat(3) + (cachedAuth || '4c9b7d21'),
    ...CANDIDATE_KEYS
  ];

  for (const k of dynamicKeys) {
    try {
      const key = CryptoJS.enc.Utf8.parse(k);
      const iv = CryptoJS.enc.Utf8.parse(k.slice(0, 16));
      const decrypted = CryptoJS.AES.decrypt(cipherB64, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.ZeroPadding
      });
      const text = decrypted.toString(CryptoJS.enc.Utf8).replace(/\0+$/, '');
      if (text) {
        const parsed = JSON.parse(text);
        if (parsed && (parsed.resources || parsed.title)) {
          return parsed;
        }
      }
    } catch (e) {}
  }
  return null;
}

/**
 * Client-Side Media Extractor: runs directly in the user's browser.
 * Bypasses serverless datacenter IP restrictions (like AWS Lambda 403 on Netlify).
 */
export async function extractClientSide(videoId, fullUrl, isRetry = false) {
  const url = fullUrl || `https://www.youtube.com/watch?v=${videoId}`;
  const auth = cachedAuth || '4c9b7d21';

  const params = new URLSearchParams({
    hostname: 'vidssave.com',
    auth: auth,
    domain: 'api-ak.vidssave.com',
    link: url
  });

  const res = await fetch('https://api.vidssave.com/api/contentsite_api/media/parse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!res.ok) {
    throw new Error(`ClientExtractor HTTP error: ${res.status}`);
  }

  const raw = await res.json();
  if (!raw || raw.status !== 1 || !raw.data) {
    if (!isRetry) {
      console.log('[ClientExtractor] Parse failed, refreshing auth key...');
      await scrapeFreshAuth();
      return extractClientSide(videoId, fullUrl, true);
    }
    throw new Error(`ClientExtractor parse rejected: ${JSON.stringify(raw).slice(0, 150)}`);
  }

  const parsed = decryptPayload(raw.data);
  if (!parsed) {
    throw new Error('ClientExtractor failed to decrypt payload');
  }

  let audioList = (parsed.resources || []).filter(r => r.type === 'audio' && r.download_url);
  if (!audioList.length) {
    // Fallback to video resource (contains AAC audio track)
    audioList = (parsed.resources || []).filter(r => r.download_url);
  }
  if (!audioList.length) {
    throw new Error('ClientExtractor: No playable audio resource found');
  }

  // Prefer 128KBPS or 256KBPS for fast playback
  const qualityOrder = ['128KBPS', '256KBPS', 'LOW', '48KBPS', '360P', '480P', '720P'];
  audioList.sort((a, b) => {
    let ia = qualityOrder.indexOf(a.quality);
    let ib = qualityOrder.indexOf(b.quality);
    if (ia === -1) ia = 99;
    if (ib === -1) ib = 99;
    return ia - ib;
  });

  const chosen = audioList[0];
  const dur = parsed.duration;
  const durationStr = dur ? `${Math.floor(dur / 60)}:${(dur % 60).toString().padStart(2, '0')}` : null;

  return {
    title: parsed.title,
    thumbnail: parsed.thumbnail || null,
    duration: durationStr,
    audioUrl: chosen.download_url,
    quality: chosen.quality
  };
}
