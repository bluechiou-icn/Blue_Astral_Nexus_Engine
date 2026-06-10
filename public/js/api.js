// ════════════════════════════════════════════════════════
// API — fetch wrappers（一律附 _t 防快取參數）
// ════════════════════════════════════════════════════════

async function apiChart(d, t, g, city = '') {
  const cityParam = city ? `&city=${encodeURIComponent(city)}` : '';
  const r = await fetch(`/api/chart?date=${encodeURIComponent(d)}&time=${encodeURIComponent(t)}&gender=${encodeURIComponent(g)}${cityParam}&_t=${ts()}`);
  const j = await r.json(); if (!r.ok) throw new Error(j.error||'HTTP '+r.status); return j;
}

async function apiFlow(d, t, g, y, city = '') {
  const cityParam = city ? `&city=${encodeURIComponent(city)}` : '';
  const r = await fetch(`/api/flow?date=${encodeURIComponent(d)}&time=${encodeURIComponent(t)}&gender=${encodeURIComponent(g)}&year=${y}${cityParam}&_t=${ts()}`);
  const j = await r.json(); if (!r.ok) throw new Error(j.error||'HTTP '+r.status); return j;
}
