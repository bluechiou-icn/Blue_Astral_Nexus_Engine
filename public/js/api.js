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

// Feature 2（Blue 2026-06-20）：本日運勢。對外只回 { fortuneText, tier }，owner 多回 { debug }。
// 帶登入 token（記憶體 only）+ same-origin cookie（ane_owner，供 owner debug 判定）。
async function apiDailyFortune(d, t, g, targetDate) {
  const headers = (typeof Cloud !== 'undefined' && Cloud.token) ? { Authorization: `Bearer ${Cloud.token}` } : {};
  const r = await fetch(`/api/daily-fortune?date=${encodeURIComponent(d)}&time=${encodeURIComponent(t)}&gender=${encodeURIComponent(g)}&targetDate=${encodeURIComponent(targetDate)}&_t=${ts()}`,
    { headers, credentials: 'same-origin' });
  const j = await r.json(); if (!r.ok) throw new Error(j.error||'HTTP '+r.status); return j;
}
