// Pembungkus fetch: cookie sesi same-origin, timeout, galat terstruktur { status, code, message }.
export async function api(path, { method = 'GET', json, body, headers, signal, timeout = 10000 } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  if (signal) signal.addEventListener('abort', () => ctl.abort(), { once: true });
  try {
    const res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: json !== undefined ? JSON.stringify(json) : body,
      signal: ctl.signal,
    });
    let data = null;
    try { data = await res.json(); } catch (_) { /* tubuh kosong / bukan JSON */ }
    if (!res.ok) throw Object.assign(new Error(data?.message || `Permintaan gagal (${res.status})`), { status: res.status, code: data?.code, data });
    return data;
  } catch (err) {
    if (err.status) throw err;
    throw Object.assign(new Error(err.name === 'AbortError' ? 'Waktu permintaan habis.' : 'Tidak dapat terhubung ke server.'), { status: 0, code: 'network' });
  } finally {
    clearTimeout(timer);
  }
}
