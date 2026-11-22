// Pub-sub sangat kecil untuk peristiwa lintas komponen (toast, perayaan streak, sesi berakhir).
const map = new Map();
export const on = (type, fn) => {
  if (!map.has(type)) map.set(type, new Set());
  map.get(type).add(fn);
  return () => map.get(type)?.delete(fn);
};
export const emit = (type, payload) => map.get(type)?.forEach((fn) => { try { fn(payload); } catch (e) { console.error(e); } });
