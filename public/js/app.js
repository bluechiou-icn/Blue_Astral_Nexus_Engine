// ════════════════════════════════════════════════════════
// UI — meta / flow bars
// ════════════════════════════════════════════════════════

function updateMetaBar() {
  const d = S.chartData; if (!d) return;
  const mingPal = d.palaces.find(p=>p.name==='命宮');
  document.getElementById('meta-bar').innerHTML = [
    [t('meta_wuxing'),  d.fiveElementsClass],
    [t('meta_yinyang'), d.yinYang],
    [t('meta_ming'),    mingPal?.stemBranch||'—'],
    [t('meta_body'),    d.bodyPalace?.name||'—'],
    [t('meta_origin'),  d.originalPalace?.name||'—'],
  ].map(([l,v])=>`<div class="mi"><span class="ml">${l}</span><span class="mv">${v}</span></div>`)
   .join('<span class="msep">·</span>');
}

function updateFlowBar() {
  const fd = S.flowData;
  document.getElementById('fc-year').textContent = S.currentYear;
  if (!fd) return;
  const fy = fd.flowYear, ml = fd.currentMajorLimit;
  const { start, end } = lunarYearRange(S.currentYear);
  document.getElementById('fc-gz').textContent  = `${fy.ganZhi}年　${start}〜${end}`;
  document.getElementById('fc-age').textContent = `${t('age_prefix')}${fy.chineseAge}${t('age_suffix')}`;
  document.getElementById('fc-limit').textContent = ml
    ? `${t('limit_label')}${ml.palace}${t('limit_palace')}　${ml.startYear}~${ml.endYear}` : '';
}

// ════════════════════════════════════════════════════════
// 檢視模式（本命 / 本命＋大限 / 本命＋大限＋流年）
// ════════════════════════════════════════════════════════

function setViewMode(mode) {
  if (!['natal','decade','flow'].includes(mode)) return;
  S.viewMode = mode;
  renderViewModeBar();
  renderAllCharts();
}

function renderViewModeBar() {
  const bar = document.getElementById('view-mode-bar');
  if (!bar) return;
  const modes = [
    ['natal',  t('view_natal')],
    ['decade', t('view_decade')],
    ['flow',   t('view_flow')],
  ];
  bar.innerHTML =
    `<span class="axis-label">${t('view_mode_label')}</span>` +
    modes.map(([m, label]) =>
      `<button class="seg-btn${S.viewMode === m ? ' active' : ''}" onclick="setViewMode('${m}')">${label}</button>`
    ).join('');
}

// ════════════════════════════════════════════════════════
// 大限軸 / 流年軸（雙軸切換）
// ════════════════════════════════════════════════════════

function renderAxes() {
  renderDecadeAxis();
  renderYearAxis();
}

function renderDecadeAxis() {
  const el = document.getElementById('decade-axis');
  if (!el) return;
  const lims = S.chartData?.majorLimits || [];
  if (!lims.length) { el.innerHTML = ''; return; }
  const cur = limitForYear(S.currentYear);
  el.innerHTML =
    `<span class="axis-label">${t('decade_axis_label')}</span>` +
    `<div class="chips-scroll">` +
    lims.map(l => {
      const active = cur && l.order === cur.order;
      return `<button class="chip${active ? ' active' : ''}" onclick="gotoDecade(${l.order})">` +
        `<span class="chip-main">${l.startAge}-${l.endAge}${t('age_suffix')}</span>` +
        `<span class="chip-sub">${l.stemBranch}　${l.palace}</span>` +
      `</button>`;
    }).join('') +
    `</div>`;
  // 自動捲到當前大限
  const act = el.querySelector('.chip.active');
  if (act) act.scrollIntoView({ block: 'nearest', inline: 'center' });
}

function renderYearAxis() {
  const el = document.getElementById('year-axis');
  if (!el) return;
  const cur = limitForYear(S.currentYear);
  if (!cur) { el.innerHTML = ''; return; }
  const years = [];
  for (let y = cur.startYear; y <= cur.endYear; y++) years.push(y);
  el.innerHTML =
    `<span class="axis-label">${t('year_axis_label')}</span>` +
    `<div class="chips-scroll">` +
    years.map(y => {
      const gz = getYearStem(y) + getYearBranch(y);
      const active = y === S.currentYear;
      return `<button class="chip chip-year${active ? ' active' : ''}" onclick="gotoYear(${y})">` +
        `<span class="chip-main">${gz}</span>` +
        `<span class="chip-sub">${y}</span>` +
      `</button>`;
    }).join('') +
    `</div>`;
  const act = el.querySelector('.chip.active');
  if (act) act.scrollIntoView({ block: 'nearest', inline: 'center' });
}

// 點大限 chip → 跳到該大限第一年（引擎為唯一真實來源，疊盤由 /api/flow 回算）
function gotoDecade(order) {
  const lims = S.chartData?.majorLimits || [];
  const target = lims.find(l => l.order === order);
  if (!target) return;
  gotoYear(target.startYear);
}

// Shift+←/→：切換到相鄰大限
function changeDecade(delta) {
  const lims = S.chartData?.majorLimits || [];
  if (!lims.length) return;
  let idx = lims.findIndex(l => S.currentYear >= l.startYear && S.currentYear <= l.endYear);
  if (idx < 0) {
    // 當前年不在任何大限內（如未起運幼年）：右切→第一個未來大限，左切→最後一個過去大限
    if (delta > 0) idx = lims.findIndex(l => l.startYear > S.currentYear) - 1;
    else {
      for (let i = lims.length - 1; i >= 0; i--) if (lims[i].endYear < S.currentYear) { idx = i + 1; break; }
    }
    if (idx < -1) return;
  }
  const next = lims[Math.min(lims.length - 1, Math.max(0, idx + delta))];
  if (!next) return;
  gotoYear(next.startYear);
}

// ════════════════════════════════════════════════════════
// 年份導航（絕對跳轉 + 相對切換，含快取）
// ════════════════════════════════════════════════════════

async function gotoYear(year) {
  if (!S.chartData || isNaN(year) || year < 1900 || year > 2100) return;
  S.selectedBranch = null; stopTrineAnim();
  S.currentYear = year;
  document.getElementById('fc-year').textContent = S.currentYear;
  ['fc-gz','fc-age','fc-limit'].forEach(id => document.getElementById(id).textContent='');
  try {
    // 已抓過的年份直接用快取，不重打 API
    let fd = S.flowDataByYear[year];
    if (!fd) {
      fd = await apiFlow(S.birthDate, S.birthTime, S.gender, year, S.city);
      S.flowDataByYear[year] = fd;
    }
    S.flowData = fd;
    S.yearBlocks = [year].map(y => {
      const gz = getYearStem(y) + getYearBranch(y);
      return { year: y, gz, canvasId: `chart-canvas-${y}` };
    });
    updateFlowBar();
    renderAxes();
    buildChartBlocks();
    renderAllCharts();
  } catch(e) { console.error('Flow error:', e); }
}

async function changeYear(delta) {
  await gotoYear(S.currentYear + delta);
}

// ════════════════════════════════════════════════════════
// 鍵盤導航：←/→ 流年、Shift+←/→ 大限
// ════════════════════════════════════════════════════════

document.addEventListener('keydown', (e) => {
  if (!S.chartData) return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  e.preventDefault();
  const delta = e.key === 'ArrowRight' ? 1 : -1;
  if (e.shiftKey) changeDecade(delta);
  else changeYear(delta);
});

// ════════════════════════════════════════════════════════
// 觸控手勢：單指左右滑 = 切流年；雙指左右滑 = 切大限
// ════════════════════════════════════════════════════════

(function setupSwipe() {
  let startX = 0, startY = 0, fingers = 0, tracking = false;
  document.addEventListener('touchstart', (e) => {
    if (!S.chartData) return;
    if (!e.target.closest('#charts-container')) { tracking = false; return; }
    tracking = true;
    fingers = e.touches.length;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!tracking || !S.chartData) return;
    tracking = false;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    S.lastSwipeTs = Date.now();
    const delta = dx < 0 ? 1 : -1;  // 往左滑 = 下一個
    if (fingers >= 2) changeDecade(delta);
    else changeYear(delta);
  }, { passive: true });
})();

// ════════════════════════════════════════════════════════
// HANDLERS
// ════════════════════════════════════════════════════════

// Update the helper text under #f-year showing 干支年 + 起訖日
function updateYearHint() {
  const hint = document.getElementById('year-hint');
  if (!hint) return;
  const yv = document.getElementById('f-year').value.trim();
  const y  = yv ? parseInt(yv) : new Date().getFullYear();
  if (isNaN(y) || y < 1900 || y > 2100) { hint.textContent = ''; return; }
  const gz = getYearStem(y) + getYearBranch(y);
  const { start, end } = lunarYearRange(y);
  hint.textContent = `${gz}年　${start}〜${end}`;
}

async function handleSubmit() {
  const date   = document.getElementById('f-date').value;
  const time   = document.getElementById('f-time').value;
  const gender = document.querySelector('input[name=g]:checked')?.value;
  const name   = document.getElementById('f-name').value.trim();
  const city   = document.getElementById('f-city')?.value.trim() || '';
  const yv     = document.getElementById('f-year').value.trim();
  const err    = document.getElementById('form-err');

  err.style.display = 'none';
  if (!date||!time||!gender) {
    err.textContent = t('err_required');
    err.style.display = 'block'; return;
  }

  const mainYear = yv ? parseInt(yv) : new Date().getFullYear();
  const allYears = [mainYear];

  Object.assign(S, { birthDate:date, birthTime:time, gender, name, city, currentYear:mainYear });

  document.getElementById('input-panel').style.display = 'none';
  document.getElementById('chart-area').style.display  = 'none';
  document.getElementById('loading').style.display     = 'block';

  try {
    const chartData = await apiChart(date, time, gender, city);
    S.chartData = chartData;
    S.flowDataByYear = {};
    const flows = await Promise.all(allYears.map(y => apiFlow(date, time, gender, y, city)));
    allYears.forEach((y, i) => { S.flowDataByYear[y] = flows[i]; });
    S.flowData = S.flowDataByYear[mainYear];

    document.getElementById('loading').style.display = 'none';
    document.getElementById('chart-area').style.display = 'block';

    S.yearBlocks = allYears.map(y => {
      const gz = getYearStem(y) + getYearBranch(y);
      return { year: y, gz, canvasId: `chart-canvas-${y}` };
    });

    updateMetaBar(); updateFlowBar();
    renderViewModeBar(); renderAxes();
    buildChartBlocks();
    renderAllCharts();
  } catch(e) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('input-panel').style.display = 'block';
    err.textContent = t('err_failed') + e.message; err.style.display = 'block';
  }
}

// Build the DOM for each year block (title + canvas + actions)
function buildChartBlocks() {
  const container = document.getElementById('charts-container');
  container.innerHTML = '';
  for (const blk of S.yearBlocks) {
    const div = document.createElement('div');
    div.className = 'chart-block';
    const isMain = blk.year === S.currentYear;
    const { start, end } = lunarYearRange(blk.year);
    div.innerHTML = `
      <div class="chart-block-title">${isMain ? t('block_main') : t('block_extra')}　${blk.year}　${blk.gz}年　${start}〜${end}</div>
      <div class="canvas-wrap"><canvas id="${blk.canvasId}"></canvas></div>
      <div class="chart-block-actions">
        <button onclick="exportPNGForYear(${blk.year})">${t('btn_export')} ${blk.year} ${t('btn_export_suffix')}</button>
      </div>
    `;
    container.appendChild(div);
  }
}

function renderAllCharts() {
  for (const blk of S.yearBlocks) {
    const canvas = document.getElementById(blk.canvasId);
    if (!canvas) continue;
    const fd = S.flowDataByYear[blk.year];
    renderChartTo(canvas, fd);
  }
}

function exportPNGForYear(year) {
  const canvas = document.getElementById(`chart-canvas-${year}`);
  if (!canvas) return;
  const link = document.createElement('a');
  const n = S.name ? S.name+'_' : '';
  link.download = `${n}${S.birthDate}_流年${year}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function resetChart() {
  stopTrineAnim();
  S.selectedBranch = null;
  S.chartData=null; S.flowData=null; S.flowDataByYear={}; S.yearBlocks=[];
  document.getElementById('chart-area').style.display  = 'none';
  document.getElementById('input-panel').style.display = 'block';
}

// Recompute extra years list whenever main flow year input changes
document.addEventListener('DOMContentLoaded', () => {
  applyI18n();
  updateYearHint();
  const fy = document.getElementById('f-year');
  if (fy) fy.addEventListener('input', updateYearHint);
});
// Also run immediately in case DOMContentLoaded already fired
updateYearHint();

window.addEventListener('resize', () => { if (S.yearBlocks.length) renderAllCharts(); });

// ════════════════════════════════════════════════════════
// CITY AUTOCOMPLETE
// ════════════════════════════════════════════════════════
const CITY_DATA = [
  // 台灣
  { name:'台北', code:'TPE', region:'台灣', tz:8 },
  { name:'台中', code:'RMQ', region:'台灣', tz:8 },
  { name:'台南', code:'TNN', region:'台灣', tz:8 },
  { name:'高雄', code:'KHH', region:'台灣', tz:8 },
  { name:'新北', code:'',    region:'台灣', tz:8 },
  { name:'桃園', code:'TPE', region:'台灣', tz:8 },
  { name:'新竹', code:'',    region:'台灣', tz:8 },
  { name:'基隆', code:'',    region:'台灣', tz:8 },
  // 港澳
  { name:'香港', code:'HKG', region:'香港', tz:8 },
  { name:'澳門', code:'MFM', region:'澳門', tz:8 },
  // 中國
  { name:'上海', code:'PVG', region:'中國', tz:8 },
  { name:'北京', code:'PEK', region:'中國', tz:8 },
  { name:'廣州', code:'CAN', region:'中國', tz:8 },
  { name:'深圳', code:'SZX', region:'中國', tz:8 },
  { name:'成都', code:'CTU', region:'中國', tz:8 },
  { name:'重慶', code:'CKG', region:'中國', tz:8 },
  { name:'武漢', code:'WUH', region:'中國', tz:8 },
  // 韓國
  { name:'首爾', code:'ICN', region:'韓國', tz:9 },
  { name:'釜山', code:'PUS', region:'韓國', tz:9 },
  // 日本
  { name:'東京', code:'NRT', region:'日本', tz:9 },
  { name:'大阪', code:'KIX', region:'日本', tz:9 },
  // 東南亞
  { name:'曼谷',    code:'BKK', region:'泰國',   tz:7 },
  { name:'新加坡',  code:'SIN', region:'新加坡', tz:8 },
  { name:'吉隆坡',  code:'KUL', region:'馬來西亞', tz:8 },
  { name:'胡志明市',code:'SGN', region:'越南',   tz:7 },
  { name:'河內',    code:'HAN', region:'越南',   tz:7 },
  // 北美
  { name:'洛杉磯', code:'LAX', region:'美國',  tz:-8 },
  { name:'紐約',   code:'JFK', region:'美國',  tz:-5 },
  { name:'多倫多', code:'YYZ', region:'加拿大', tz:-5 },
  // 歐洲
  { name:'倫敦', code:'LHR', region:'英國', tz:0 },
  { name:'巴黎', code:'CDG', region:'法國', tz:1 },
];

// 機場代號反查 → 城市名
const CODE_MAP = {};
CITY_DATA.forEach(c => { if (c.code) CODE_MAP[c.code.toUpperCase()] = c.name; });

function searchCities(q) {
  if (!q) return [];
  const uq = q.toUpperCase().trim();
  const lq = q.toLowerCase().trim();
  // 完全匹配機場代號優先
  const byCode = CITY_DATA.filter(c => c.code && c.code.toUpperCase().startsWith(uq));
  // 城市名包含
  const byName = CITY_DATA.filter(c =>
    !byCode.includes(c) && c.name.includes(lq)
  );
  // 地區包含
  const byRegion = CITY_DATA.filter(c =>
    !byCode.includes(c) && !byName.includes(c) && c.region.includes(lq)
  );
  return [...byCode, ...byName, ...byRegion].slice(0, 8);
}

function renderDropdown(items, activeIdx) {
  const dd = document.getElementById('city-dropdown');
  if (!items.length) { dd.classList.remove('open'); return; }
  dd.innerHTML = items.map((c, i) => {
    const tzStr = c.tz >= 0 ? `UTC+${c.tz}` : `UTC${c.tz}`;
    return `<div class="city-opt${i === activeIdx ? ' active' : ''}" data-name="${c.name}">
      <span>${c.name} <span style="color:#aaa;font-size:11px">${c.region}</span></span>
      <span>${c.code ? `<span class="city-opt-code">${c.code}</span>` : ''}<span class="city-opt-tz">${tzStr}</span></span>
    </div>`;
  }).join('');
  dd.classList.add('open');
  dd.querySelectorAll('.city-opt').forEach(el => {
    el.addEventListener('mousedown', e => {
      e.preventDefault();
      document.getElementById('f-city').value = el.dataset.name;
      dd.classList.remove('open');
      _cityItems = []; _cityActiveIdx = -1;
    });
  });
}

let _cityItems = [], _cityActiveIdx = -1;

document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('f-city');
  const dd  = document.getElementById('city-dropdown');
  if (!inp) return;

  inp.addEventListener('input', () => {
    const q = inp.value.trim();
    // 若輸入 3 個大寫字母，嘗試機場代號直接替換
    if (/^[A-Za-z]{3}$/.test(q) && CODE_MAP[q.toUpperCase()]) {
      inp.value = CODE_MAP[q.toUpperCase()];
      dd.classList.remove('open');
      return;
    }
    _cityItems = searchCities(q);
    _cityActiveIdx = -1;
    renderDropdown(_cityItems, _cityActiveIdx);
  });

  inp.addEventListener('keydown', e => {
    if (!dd.classList.contains('open')) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _cityActiveIdx = Math.min(_cityActiveIdx + 1, _cityItems.length - 1);
      renderDropdown(_cityItems, _cityActiveIdx);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      _cityActiveIdx = Math.max(_cityActiveIdx - 1, -1);
      renderDropdown(_cityItems, _cityActiveIdx);
    } else if (e.key === 'Enter' && _cityActiveIdx >= 0) {
      e.preventDefault();
      inp.value = _cityItems[_cityActiveIdx].name;
      dd.classList.remove('open');
      _cityItems = []; _cityActiveIdx = -1;
    } else if (e.key === 'Escape') {
      dd.classList.remove('open');
    }
  });

  inp.addEventListener('blur', () => {
    setTimeout(() => dd.classList.remove('open'), 150);
  });

  // 點擊輸入框時若有值也顯示搜尋
  inp.addEventListener('focus', () => {
    const q = inp.value.trim();
    if (q && q !== '台北') {
      _cityItems = searchCities(q);
      renderDropdown(_cityItems, -1);
    }
  });
});

// ════════════════════════════════════════════════════════
// AUTO-FILL FROM URL (engine landing page handoff)
// ════════════════════════════════════════════════════════
(function autoFillFromUrl() {
  const p = new URLSearchParams(window.location.search);
  const date   = p.get('date');
  const time   = p.get('time');
  const gender = p.get('gender');
  if (!date || !time || !gender) return;
  function fill() {
    const fd = document.getElementById('f-date');
    const ft = document.getElementById('f-time');
    const fg = document.querySelector(`input[name=g][value="${gender}"]`);
    const fc = document.getElementById('f-city');
    if (!fd || !ft || !fg) return;
    fd.value = date;
    ft.value = time;
    fg.checked = true;
    const city = p.get('city');
    if (city && fc) fc.value = city;
    handleSubmit();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fill);
  } else {
    fill();
  }
})();
