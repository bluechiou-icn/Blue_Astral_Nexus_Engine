// ════════════════════════════════════════════════════════
// synastry-app.js — 雙人合盤頁入口
//   1. 解析 URL params（selfId/partnerId 或直接 date1/time1/...）
//   2. 呼 /api/synastry 拉雙盤 + 交叉飛化 + 共振
//   3. 用 chart-render 的 renderChartTo 渲染兩個 canvas（swap-S 模式）
//   4. 觸發 synastry-matrix 的 renderMatrix 畫中央 SVG
//   Sprint 4 P0，依 ClaudeCode_20260617_4_Sprint4_Spec.md
// ════════════════════════════════════════════════════════

// chart.html 專屬全域 fn 在 synastry.html 上不存在；setLang 會在語系切換時呼
// 它們，stub 成 noop 避免 ReferenceError。renderAllCharts 重綁到本頁的
// re-render 邏輯。
(function stubChartGlobals() {
  const noop = () => {};
  window.updateMetaBar    = window.updateMetaBar    || noop;
  window.updateFlowBar    = window.updateFlowBar    || noop;
  window.renderViewModeBar= window.renderViewModeBar|| noop;
  window.renderAxes       = window.renderAxes       || noop;
  window.buildChartBlocks = window.buildChartBlocks || noop;
  window.renderMonthAxis  = window.renderMonthAxis  || noop;
  window.renderLibrary    = window.renderLibrary    || noop;
  // updateTripleStemBanner / updateFormationBadges 也是 app.js 才有
  window.updateTripleStemBanner = window.updateTripleStemBanner || noop;
  window.updateFormationBadges  = window.updateFormationBadges  || noop;
  // renderAllCharts 在 setLang 末尾被呼；重綁到本頁的 rerender
  window.renderAllCharts  = () => { if (typeof synastryRerender === 'function') synastryRerender(); };
})();

// 模組級狀態 —— 兩份命盤資料 + synastry payload
const SYN = {
  chartA: null,     // chart1 from /api/synastry
  chartB: null,     // chart2
  payload: null,    // synastry.{ chart1BirthYearToChart2[], ..., resonances[] }
  metaA: null,      // { date, time, gender, name, city }
  metaB: null,
};

// ── URL params 解析 ─────────────────────────────────────────
function parseSynastryParams() {
  const q = new URLSearchParams(window.location.search);
  // 路徑 1：selfId + partnerId（從 Cloud store 撈 chart 取生辰）
  const selfId    = q.get('selfId');
  const partnerId = q.get('partnerId');
  if (selfId && partnerId) {
    const store = (typeof loadLocalStore === 'function') ? loadLocalStore() : null;
    if (!store || !Array.isArray(store.charts)) return null;
    const self    = store.charts.find(c => c.id === selfId);
    const partner = store.charts.find(c => c.id === partnerId);
    if (!self || !partner) return null;
    return {
      a: { date: self.date,    time: self.time,    gender: self.gender,    city: self.city || '', name: self.name || '', chartSet: self.chartSet !== false },
      b: { date: partner.date, time: partner.time, gender: partner.gender, city: partner.city || '', name: partner.name || '', chartSet: partner.chartSet !== false },
    };
  }
  // 路徑 2：直接帶生辰
  const a = {
    date:    q.get('date1'),    time:   q.get('time1'),
    gender:  q.get('gender1'),  city:   q.get('city1') || '',
    name:    q.get('name1') || '',
    chartSet: q.get('chartSet1') !== '0',
  };
  const b = {
    date:    q.get('date2'),    time:   q.get('time2'),
    gender:  q.get('gender2'),  city:   q.get('city2') || '',
    name:    q.get('name2') || '',
    chartSet: q.get('chartSet2') !== '0',
  };
  if (a.date && a.time && a.gender && b.date && b.time && b.gender) {
    return { a, b };
  }
  return null;
}

// ── API call ───────────────────────────────────────────────
async function fetchSynastry(a, b) {
  // 已定盤 → 不傳 city（引擎跳過真太陽時校正，與單盤 chart.html 行為一致）
  const cityA = a.chartSet ? '' : a.city;
  const cityB = b.chartSet ? '' : b.city;
  const params = new URLSearchParams({
    date1: a.date, time1: a.time, gender1: a.gender,
    date2: b.date, time2: b.time, gender2: b.gender,
    _t: new Date().toISOString().replace(/\D/g, '').slice(0, 8),
  });
  if (cityA) params.set('city1', cityA);
  if (cityB) params.set('city2', cityB);
  const r = await fetch(`/api/synastry?${params.toString()}`);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
  return j;
}

// ── 雙盤渲染（swap-S 模式）─────────────────────────────────
//   chart-render.renderChartTo 讀 global S.chartData；逐個 canvas 渲染前
//   swap 進對應 chartData，渲完恢復成最後一個（B），避免事件處理用到舊資料
function renderBothCharts() {
  if (!SYN.chartA || !SYN.chartB) return;
  S.viewMode = 'natal';           // 合盤 MVP：純本命（不疊大限/流年）
  S.monthMingBranch = null;

  // 為配合 chart-render 的 bindPalaceClick / bindLuJiHover，臨時清掉 dataset
  // 避免兩個 canvas 共用同一個 hover state
  const canvasA = document.getElementById('syn-canvas-a');
  const canvasB = document.getElementById('syn-canvas-b');

  // 左盤 A
  S.chartData = SYN.chartA;
  S.birthDate = SYN.metaA.date; S.birthTime = SYN.metaA.time;
  S.gender    = SYN.metaA.gender; S.name = SYN.metaA.name;
  S.city      = SYN.metaA.city;
  renderChartTo(canvasA, null);

  // 右盤 B
  S.chartData = SYN.chartB;
  S.birthDate = SYN.metaB.date; S.birthTime = SYN.metaB.time;
  S.gender    = SYN.metaB.gender; S.name = SYN.metaB.name;
  S.city      = SYN.metaB.city;
  renderChartTo(canvasB, null);

  // 留下 A 在 S 比較好處理 hover 對應（hover 預設讀 S.chartData；雙 canvas
  // 各自的 hover handler 已綁定當下 state，所以結束後 S 留 A 或 B 都可）
  // 這裡留 A，因為矩陣 hover 文字會用到 SYN.payload，不會吃 S
  S.chartData = SYN.chartA;
}

// ── Toolbar / 副標 / 共振 chip ──────────────────────────────
function renderToolbar() {
  const labelA = (SYN.metaA.name || t('syn_left')) +
    `　${SYN.metaA.date} ${SYN.metaA.time} ${SYN.metaA.gender}` +
    (SYN.metaA.city ? `　${SYN.metaA.city}` : '') +
    (SYN.metaA.chartSet ? `　[${t('syn_calibrated') || '已定盤'}]` : '');
  const labelB = (SYN.metaB.name || t('syn_right')) +
    `　${SYN.metaB.date} ${SYN.metaB.time} ${SYN.metaB.gender}` +
    (SYN.metaB.city ? `　${SYN.metaB.city}` : '') +
    (SYN.metaB.chartSet ? `　[${t('syn_calibrated') || '已定盤'}]` : '');
  document.getElementById('syn-meta-a').innerHTML = '<b>A</b>　' + labelA;
  document.getElementById('syn-meta-b').innerHTML = '<b>B</b>　' + labelB;
  document.getElementById('syn-sub-a').textContent =
    `${SYN.chartA.yinYang || ''}　${SYN.chartA.fiveElementsClass || ''}`;
  document.getElementById('syn-sub-b').textContent =
    `${SYN.chartB.yinYang || ''}　${SYN.chartB.fiveElementsClass || ''}`;

  // 大限信息
  const dA = SYN.payload?.chart1CurrentDecade;
  const dB = SYN.payload?.chart2CurrentDecade;
  const modeText = (dA && dB)
    ? `${t('syn_matrix_birth_decade')} (A: ${dA.stem} / B: ${dB.stem})`
    : t('syn_matrix_birth_only');
  document.getElementById('syn-matrix-mode').textContent = modeText;
}

function renderResonanceBar() {
  const bar = document.getElementById('syn-resonance-bar');
  const resonances = SYN.payload?.resonances || [];
  if (!resonances.length) { bar.style.display = 'none'; return; }
  const label = `<span class="syn-label">${t('syn_resonance_section')}</span>`;
  const chips = resonances.map((r, i) => {
    const dirClass = r.direction === 'A→B' ? 'dir-a-b'
                   : r.direction === 'B→A' ? 'dir-b-a' : '';
    const title = (r.note || '').replace(/"/g, '&quot;');
    return `<span class="res-chip ${dirClass}" data-idx="${i}" title="${title}">${r.type}</span>`;
  }).join('');
  bar.innerHTML = label + chips;
  bar.style.display = 'flex';
  bar.onclick = (e) => {
    const chip = e.target.closest('.res-chip');
    if (!chip) return;
    const r = resonances[parseInt(chip.dataset.idx, 10)];
    if (!r) return;
    // 若 resonance 帶 branch → 在雙盤對應宮格閃金色 outline
    if (r.branch && typeof flashSynPalaceByBranch === 'function') {
      flashSynPalaceByBranch('A', r.branch, 'auspicious');
      flashSynPalaceByBranch('B', r.branch, 'auspicious');
    }
  };
}

// 共振 chip 點擊用：在指定盤 canvas 上閃宮格
function flashSynPalaceByBranch(side, branch, variant) {
  const canvas = document.getElementById(side === 'A' ? 'syn-canvas-a' : 'syn-canvas-b');
  if (!canvas || typeof BRANCH_POS === 'undefined') return;
  const rect = canvas.getBoundingClientRect();
  const scale = rect.width / BASE;
  const [row, col] = BRANCH_POS[branch] || [];
  if (row == null) return;
  const cell = CELL * scale;
  const color =
      variant === 'auspicious' ? '#d4af37'
    : variant === 'challenge'  ? '#9f1f1f'
    :                            '#ea7c1c';
  const overlay = document.createElement('div');
  overlay.style.cssText =
    `position:absolute;left:${rect.left + col*cell + window.scrollX}px;` +
    `top:${rect.top + row*cell + window.scrollY}px;` +
    `width:${cell}px;height:${cell}px;` +
    `border:3px solid ${color};border-radius:2px;` +
    `pointer-events:none;z-index:8000;opacity:1;transition:opacity 0.25s;`;
  document.body.appendChild(overlay);
  let n = 0;
  const blink = () => {
    overlay.style.opacity = (n % 2 === 0) ? '0.1' : '1';
    n++;
    if (n < 4) setTimeout(blink, 280);
    else setTimeout(() => overlay.remove(), 300);
  };
  setTimeout(blink, 200);
}

// ── 全域重繪入口（語系切換 / 視窗 resize 都呼這個）──────────
function synastryRerender() {
  if (!SYN.chartA || !SYN.chartB) return;
  applyI18n();
  renderToolbar();
  renderResonanceBar();
  renderBothCharts();
  if (typeof window.renderSynastryMatrix === 'function') {
    window.renderSynastryMatrix(SYN.payload, SYN.chartA, SYN.chartB);
  }
}
window.synastryRerender = synastryRerender;

// ── 啟動流程 ──────────────────────────────────────────────
async function startSynastry() {
  const ui = {
    loading: document.getElementById('syn-loading'),
    err:     document.getElementById('syn-err'),
    layout:  document.getElementById('syn-layout'),
  };
  const showErr = (msg) => {
    ui.loading.style.display = 'none';
    ui.layout.style.display  = 'none';
    ui.err.textContent = msg;
    ui.err.style.display = 'block';
  };

  const parsed = parseSynastryParams();
  if (!parsed) {
    showErr(t('syn_err_no_params') || '缺少合盤參數。請先在主畫面綁定配偶並選擇雙方命例，或在 URL 帶上 date1/time1/gender1 + date2/time2/gender2。');
    return;
  }

  try {
    SYN.metaA = parsed.a; SYN.metaB = parsed.b;
    const resp = await fetchSynastry(parsed.a, parsed.b);
    SYN.chartA  = resp.chart1;
    SYN.chartB  = resp.chart2;
    SYN.payload = resp.synastry;

    ui.loading.style.display = 'none';
    ui.layout.style.display  = 'grid';

    synastryRerender();
  } catch (e) {
    console.error('[synastry]', e);
    showErr((t('syn_err_failed') || '合盤計算失敗：') + (e.message || e));
  }
}

// 視窗 resize 時，canvas 與 SVG 都要重畫（canvas 內容隨 max-width 縮放
// 不會失真，但矩陣 SVG path 是基於 canvas DOM rect 算的，必須重算）
let _resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => synastryRerender(), 150);
});

document.addEventListener('DOMContentLoaded', startSynastry);
