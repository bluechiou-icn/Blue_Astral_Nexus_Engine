// ════════════════════════════════════════════════════════
// UI — meta / flow bars
// ════════════════════════════════════════════════════════

// T3（Blue 2026-06-30）：命宮主星文字。有主星 → 列星名；空宮 → 「空宮借對宮 借星」。
// 資料皆來自引擎 palace 物件（majorStars / isEmpty / borrowedStars），非使用者輸入。
function mingMajorStarsText(d) {
  const ming = d.palaces.find(p => p.name === '命宮');
  if (!ming) return '—';
  if (ming.majorStars && ming.majorStars.length) {
    return ming.majorStars.map(s => tStar(s.name)).join('、');
  }
  if (ming.isEmpty && ming.borrowedStars && ming.borrowedStars.length) {
    return t('meta_empty_borrow') + ming.borrowedStars.map(s => tStar(s)).join('、');
  }
  return t('cv_empty');
}

// T3 + T4 共用：命盤核心摘要 cells（五行局 · 陰陽 · 命宮 · 主星 · 身宮 · 來因宮）。
// updateMetaBar 渲染成 HTML；chartCoreSummaryText 攤平成純文字帶回命例庫列。
function chartCoreCells(d) {
  const mingPal = d.palaces.find(p => p.name === '命宮');
  return [
    [t('meta_wuxing'),  tWuXingJu(d.fiveElementsClass)],
    [t('meta_yinyang'), tYinYang(d.yinYang)],
    [t('meta_ming'),    tGZ(mingPal?.stemBranch) || '—'],
    [t('meta_zhuxing'), mingMajorStarsText(d)],
    [t('meta_body'),    tPalaceName(d.bodyPalace?.name) || '—'],
    [t('meta_origin'),  tPalaceName(d.originalPalace?.name) || '—'],
  ];
}

// T4：攤平成單行純文字，存入命例 entry.core，供命例庫列免起盤即可見核心資料。
function chartCoreSummaryText(d) {
  if (!d || !Array.isArray(d.palaces)) return '';
  return chartCoreCells(d).map(([l, v]) => `${l}${v}`).join('・');
}

function updateMetaBar() {
  const d = S.chartData; if (!d) return;
  document.getElementById('meta-bar').innerHTML = chartCoreCells(d)
    .map(([l,v])=>`<div class="mi"><span class="ml">${l}</span><span class="mv">${v}</span></div>`)
    .join('<span class="msep">·</span>');
  updatePartnerBanner();
  updateFormationBadges();
  updateDailyFortune();
}

// #4（Blue 2026-06-30）：不確定時辰時，於命盤上方顯示「僅供參考＋定盤服務」提示；否則隱藏。
function updateUncertainTimeNotice() {
  const box = document.getElementById('uncertain-time-notice');
  if (!box) return;
  if (S.unknownTime) {
    box.textContent = '⚠ ' + t('uncertain_time_notice');
    box.style.display = '';
  } else {
    box.style.display = 'none';
    box.textContent = '';
  }
}

// Feature 2（Blue 2026-06-20）：本日基本運勢 section
//   顯示條件：登入 + store 內有命例（≥1 筆，近似「回訪用戶」；loginCount 嚴格門檻待後續）。
//   抓 /api/daily-fortune（對外只回 fortuneText；owner 多回 debug）。
//   fail-safe：任何錯誤一律隱藏，絕不影響既有 UI。Tier 2 生成器未上線時回結構佔位文字。
let _dfFetchKey = null;
async function updateDailyFortune() {
  const box = document.getElementById('daily-fortune');
  if (!box) return;
  const hide = () => { box.style.display = 'none'; box.innerHTML = ''; box.dataset.rendered = ''; };
  if (!window.Cloud || !Cloud.signedIn) return hide();
  if (!S || !S.birthDate || !S.birthTime || !S.gender) return hide();
  const store = Cloud.store;
  const hasRecord = store && Array.isArray(store.charts) && store.charts.length >= 1;
  if (!hasRecord) return hide();

  const today = todayTaipei();
  const key = `${S.birthDate}|${S.birthTime}|${S.gender}|${today}`;
  if (_dfFetchKey === key && box.dataset.rendered === '1') { box.style.display = ''; return; }
  _dfFetchKey = key;
  try {
    const r = await apiDailyFortune(S.birthDate, S.birthTime, S.gender, today);
    if (_dfFetchKey !== key) return; // 已切換命主（競態），丟棄此舊回應
    renderDailyFortune(box, r, today);
  } catch (_) {
    if (_dfFetchKey !== key) return;
    hide();
  }
}

function todayTaipei() {
  const now = new Date();
  const tpe = new Date(now.getTime() + (now.getTimezoneOffset() + 480) * 60000); // Asia/Taipei UTC+8, no DST
  const y = tpe.getFullYear(), m = String(tpe.getMonth() + 1).padStart(2, '0'), d = String(tpe.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function renderDailyFortune(box, data, today) {
  const text = (data && typeof data.fortuneText === 'string') ? data.fortuneText : '';
  if (!text) { box.style.display = 'none'; box.innerHTML = ''; box.dataset.rendered = ''; return; }
  const debugHTML = data.debug
    ? `<div class="df-debug">🔓 ${escapeHtml(data.debug)}</div>` : '';
  box.innerHTML =
    `<div class="df-head">` +
      `<span class="df-title">🩵 ${escapeHtml(t('df_title'))}</span>` +
      `<span class="df-date">${escapeHtml(today)}</span>` +
    `</div>` +
    `<div class="df-body">${escapeHtml(text).replace(/\n/g, '<br>')}</div>` +
    `<div class="df-note">${escapeHtml(t('df_disclaimer'))}</div>` +
    debugHTML;
  box.dataset.rendered = '1';
  box.style.display = '';
}

// Sprint 3.9 P8（Blue 2026-06-20）：partner 關聯 banner
//   登入 + 當前命主在 store 內有 partnerIds → 顯示「主命主 X — 配偶 Y」單行 banner，
//   點配偶名 → libraryLoad(partnerId) 切換命盤。其餘情境（未登入 / 找不到自己 / 無 partner）一律隱藏。
function updatePartnerBanner() {
  const banner = document.getElementById('partner-link-banner');
  if (!banner) return;
  const hide = () => { banner.style.display = 'none'; banner.innerHTML = ''; };
  if (!window.Cloud || !Cloud.signedIn) return hide();
  if (!S || !S.birthDate || !S.birthTime || !S.gender) return hide();
  const store = Cloud.store;
  if (!store || !Array.isArray(store.charts)) return hide();
  const me = store.charts.find(c =>
    c.date === S.birthDate && c.time === S.birthTime &&
    c.gender === S.gender && (c.name || '') === (S.name || ''));
  const partnerIds = Array.isArray(me?.partnerIds) ? me.partnerIds : [];
  if (!partnerIds.length) return hide();
  const partners = partnerIds
    .map(id => store.charts.find(c => c.id === id))
    .filter(Boolean);
  if (!partners.length) return hide();
  const selfName = escapeHtml(me.name || S.name || '—');
  // #10（Blue 2026-06-30）：輸入生辰命中命例庫且該命例有綁定配偶時，直接帶出配偶姓名＋生辰資料
  //（date/time/性別），免再點開即可看到關聯對象核心資料；點名字仍可切換到該配偶命盤。
  const partnerLinks = partners.map(p => {
    const meta = [p.date, p.time, tGenderShort(p.gender)].filter(Boolean).join(' ');
    const metaHtml = meta ? `<span class="plb-pmeta" style="opacity:0.72;font-size:0.9em;margin-left:4px;">（${escapeHtml(meta)}）</span>` : '';
    return `<span class="plb-partner" onclick="libraryLoad('${escapeHtml(p.id)}')">${escapeHtml(p.name || '—')}${metaHtml}</span>`;
  }).join('、');
  banner.innerHTML =
    `<span class="plb-self">${escapeHtml(t('partner_banner_self'))} ${selfName}</span>` +
    `<span class="plb-sep">${escapeHtml(t('partner_banner_separator'))}</span>` +
    partnerLinks +
    `<span class="plb-hint">${escapeHtml(t('partner_banner_switch_hint'))}</span>`;
  banner.style.display = '';
}

// Sprint 4 P3 — 格局徽章
//   引擎 classicalFormations[] = { name, type, palaces[], stars[], note, confidence }
//   type: 'auspicious' (金) / 'challenge' (暗紅) / 'neutral' (灰)
//   按 confidence desc 排序，前 5 個顯示完整徽章，剩下用「+N more」chip 點開展全列
//   點徽章 → 對應宮位閃爍 + 下方 fb-detail 區塊展開 note + confidence
function updateFormationBadges() {
  const box = document.getElementById('formation-badges');
  if (!box) return;
  const formations = S.chartData?.classicalFormations || [];
  if (!formations.length) { box.style.display = 'none'; box.innerHTML = ''; return; }

  const sorted = [...formations].sort((a,b) => (b.confidence||0) - (a.confidence||0));
  const TOP = 5;
  const shown   = sorted.slice(0, TOP);
  const hidden  = sorted.slice(TOP);
  let showingAll = false;

  const typeLabel = ty =>
      ty === 'auspicious' ? t('formation_type_auspicious')
    : ty === 'challenge'  ? t('formation_type_challenge')
    :                       t('formation_type_neutral');

  const chipHTML = (f, idx) => {
    const fullName = f.name || '';
    const tipText = `${typeLabel(f.type)} · ${fullName} · ${t('formation_confidence')} ${f.confidence}%\n${f.note}`;
    return `<span class="fb-chip ${f.type || 'neutral'}" data-idx="${idx}" title="${tipText.replace(/"/g,'&quot;')}">${fullName}</span>`;
  };

  const detailHTML = (f) => {
    const palText = (f.palaces || []).map(tPalaceName).join('、') || '—';
    const starText = (f.stars || []).join('、') || '—';
    return `<b>${f.name}</b><span class="fb-conf">${t('formation_confidence')} ${f.confidence}%</span><br>` +
           `<span style="color:#3a1f05;">${palText}　·　${starText}</span><br>` +
           `${f.note || ''}`;
  };

  const render = () => {
    const list = showingAll ? sorted : shown;
    const chips = list.map((f, i) => chipHTML(f, i)).join('');
    const moreChip = (!showingAll && hidden.length)
      ? `<span class="fb-chip fb-more" data-more="1">${t('formation_more').replace('{n}', hidden.length)}</span>`
      : '';
    box.innerHTML =
      `<span class="fb-label">${t('formation_section_label')}</span>` +
      chips + moreChip +
      `<div class="fb-detail"></div>`;
    box.style.display = 'flex';
  };
  render();

  box.onclick = (e) => {
    const more = e.target.closest('[data-more="1"]');
    if (more) { showingAll = true; render(); return; }
    const chip = e.target.closest('.fb-chip');
    if (!chip) return;
    const f = (showingAll ? sorted : shown)[parseInt(chip.dataset.idx, 10)];
    if (!f) return;
    const detail = box.querySelector('.fb-detail');
    detail.innerHTML = detailHTML(f);
    detail.classList.add('open');
    (f.palaces || []).forEach(p => flashPalaceOutline(p, f.type));
  };
}

function updateFlowBar() {
  const fd = S.flowData;
  document.getElementById('fc-year').textContent = S.currentYear;
  if (!fd) return;
  const fy = fd.flowYear, ml = fd.currentMajorLimit;
  const { start, end } = lunarYearRange(S.currentYear);
  document.getElementById('fc-gz').textContent  = isEn()
    ? `${tGZ(fy.ganZhi)}　${start}〜${end}`
    : `${fy.ganZhi}年　${start}〜${end}`;
  document.getElementById('fc-age').textContent = `${t('age_prefix')}${fy.chineseAge}${t('age_suffix')}`;
  document.getElementById('fc-limit').textContent = ml
    ? `${t('limit_label')}${tPalaceName(ml.palace)}${t('limit_palace')}　${ml.startYear}~${ml.endYear}` : '';
  updateTripleStemBanner();
}

// Sprint 4 P1 — 三干疊加 banner（Cassian 回饋：SARAJ 案例必須能跑出）
//   引擎 tripleStemOverlap = { isTripleOverlap, isDoubleOverlap, birthYearStem,
//     originalStem, decadeStem, note }
//   isTriple → 金色強警示；isDouble → 淺米色提示；皆無 → 隱藏
//   點 banner 展開細節列；再點宮位 chip → 對應宮格閃爍橘色 outline 2 次
function updateTripleStemBanner() {
  const banner = document.getElementById('triple-stem-banner');
  if (!banner) return;
  const ts = S.flowData?.tripleStemOverlap;
  if (!ts || (!ts.isTripleOverlap && !ts.isDoubleOverlap)) {
    banner.style.display = 'none';
    banner.classList.remove('triple', 'double', 'open');
    return;
  }
  const d = S.chartData;
  const mingPal   = d?.palaces.find(p => p.name === '命宮');
  const origPal   = d?.originalPalace?.name ? d.palaces.find(p => p.name === d.originalPalace.name) : null;
  const decadePal = S.flowData?.currentMajorLimit?.palace
    ? d?.palaces.find(p => p.name === S.flowData.currentMajorLimit.palace) : null;

  const tier = ts.isTripleOverlap ? 'triple' : 'double';
  banner.classList.remove('triple', 'double');
  banner.classList.add(tier);
  banner.style.display = 'block';

  let headline;
  if (tier === 'triple') {
    const stem = ts.birthYearStem;
    const branch = origPal?.branch || '';
    headline = `${t('tsb_triple_prefix')}${t('tsb_birth_label')}／${t('tsb_orig_label')}／${t('tsb_decade_label')} 同步 *${stem}${branch}*`;
  } else {
    headline = `${t('tsb_double_prefix')}${ts.note || ''}`;
  }

  const chip = (label, stem, palaceName) => palaceName
    ? `<span class="tsb-chip" data-palace="${palaceName}" style="display:inline-block;padding:2px 8px;margin:0 6px 4px 0;background:rgba(255,255,255,0.5);border-radius:3px;cursor:pointer;font-size:12px;">${label}：<b>${stem || '?'}</b>　${palaceName || ''}</span>`
    : `<span style="display:inline-block;padding:2px 8px;margin:0 6px 4px 0;font-size:12px;opacity:0.6;">${label}：<b>${stem || '?'}</b></span>`;

  banner.innerHTML =
    `<div>${headline} <span style="font-size:11px;opacity:0.7;">${t('tsb_click_hint')}</span></div>` +
    `<div class="tsb-detail">` +
      chip(t('tsb_birth_label'),  ts.birthYearStem, mingPal?.name) +
      chip(t('tsb_orig_label'),   ts.originalStem,  origPal?.name) +
      chip(t('tsb_decade_label'), ts.decadeStem,    decadePal?.name) +
    `</div>`;

  banner.onclick = (e) => {
    const palChip = e.target.closest('.tsb-chip');
    if (palChip) {
      flashPalaceOutline(palChip.dataset.palace);
      e.stopPropagation();
      return;
    }
    banner.classList.toggle('open');
  };
}

// 暫態 outline 閃爍 (2 次)：DOM-overlay absolute div 蓋在對應宮格座標，閃完移除
//   variant: 'triple' (橘) | 'auspicious' (金) | 'challenge' (紅) | 'neutral' (灰)
//   Sprint 4 P1 三干 chip 點擊用 'triple'；P3 格局徽章用對應 type
function flashPalaceOutline(palaceName, variant) {
  if (!palaceName || !S.chartData) return;
  const pal = S.chartData.palaces.find(p => p.name === palaceName);
  if (!pal) return;
  // BRANCH_POS / CELL / BASE 為 chart-state.js 載入的 module-level const，
  // 在共享 lexical scope 中可直接引用（classic script，非 ES module）
  const canvas = document.getElementById(S.yearBlocks?.[0]?.canvasId);
  if (!canvas || typeof BRANCH_POS === 'undefined') return;
  const rect = canvas.getBoundingClientRect();
  const scale = rect.width / BASE;
  const [row, col] = BRANCH_POS[pal.branch] || [];
  if (row == null) return;
  const cell = CELL * scale;
  const color =
      variant === 'auspicious' ? '#d4af37'
    : variant === 'challenge'  ? '#9f1f1f'
    : variant === 'neutral'    ? '#9aa0a6'
    :                            '#ea7c1c'; // default: triple-stem 橘
  const overlay = document.createElement('div');
  overlay.style.cssText =
    `position:absolute;left:${rect.left + col*cell + window.scrollX}px;` +
    `top:${rect.top + row*cell + window.scrollY}px;` +
    `width:${cell}px;height:${cell}px;` +
    `border:3px solid ${color};border-radius:2px;` +
    `pointer-events:none;z-index:8000;opacity:1;` +
    `transition:opacity 0.25s;`;
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

// ════════════════════════════════════════════════════════
// Sprint 3.9 H4：儲存到分類列（result-page）
// 顯示條件：登入 + Cloud.categories 非空 + S 已有命主資料
// 預設帶入命例現有 categoryId（編輯）；可改後按「儲存」寫回 Drive + localStorage
// ════════════════════════════════════════════════════════

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
  }[c]));
}

function updateSaveCategoryBar() {
  const bar = document.getElementById('save-category-bar');
  if (!bar) return;
  // Bug 2（Blue 2026-06-29）：dropdown 必須讀「使用者實際 live 的分類清單」，
  // 順序：store.categories（user 改過的）→ CloudExt.DEFAULT_CATEGORIES（fallback）→ Drive。
  // 原本只讀 DEFAULT_CATEGORIES → user 在「管理」改名/加分類後 dropdown 仍顯示舊清單。
  const storeCats = (window.Cloud && window.Cloud.store && Array.isArray(window.Cloud.store.categories))
    ? window.Cloud.store.categories
    : [];
  const extCats = storeCats.length ? storeCats : (window.CloudExt?.DEFAULT_CATEGORIES || []);
  const driveCats = (window.Cloud && Array.isArray(Cloud.categories)) ? Cloud.categories : [];
  if (!window.Cloud || !Cloud.signedIn || (!extCats.length && !driveCats.length)) {
    bar.style.display = 'none'; bar.innerHTML = ''; return;
  }
  if (!S || !S.birthDate || !S.birthTime || !S.gender) {
    bar.style.display = 'none'; return;
  }
  // E1（Blue 2026-06-27）：修改模式下優先按 editingId 找命例（讓 dropdown 反映「正在改的這筆」目前分類，
  // 即使 user 把 name/date/time/gender 改了，仍能準確指回原命例）。view 模式維持 4-key match。
  const current = (Cloud.editingId
    ? (Cloud.store?.charts || []).find(c => c.id === Cloud.editingId)
    : null
  ) || (Cloud.store?.charts || []).find(c =>
    c.date === S.birthDate && c.time === S.birthTime &&
    c.gender === S.gender && (c.name || '') === (S.name || ''));
  const currentCatId = current?.categoryId || '';
  const options = extCats.length
    ? extCats.map(c =>
        `<option value="${escapeHtml(c.id)}"${c.id === currentCatId ? ' selected' : ''}>${escapeHtml(c.name)}</option>`
      ).join('')
    : driveCats.map(c =>
        `<option value="${escapeHtml(c.id)}"${c.id === currentCatId ? ' selected' : ''}>${escapeHtml((c.icon ? c.icon + ' ' : '') + (c.displayName || ''))}</option>`
      ).join('');
  // E1（Blue 2026-06-27）：修改模式下顯示「更新此命例」標記，明確告訴使用者按下儲存會覆寫同一筆而非新增。
  const isEditing = !!(window.Cloud && Cloud.editingId);
  const btnLabel = isEditing ? t('save_cat_update_btn') : t('save_cat_btn');
  const editHint = isEditing ? ` <span class="scb-editing">${t('save_cat_editing_hint')}</span>` : '';
  bar.innerHTML =
    `<span class="scb-label">${t('save_cat_label')}</span>${editHint}` +
    `<select id="scb-select" class="scb-select">` +
    `<option value="">${t('save_cat_unassigned')}</option>${options}</select>` +
    `<button class="scb-btn" onclick="saveCurrentToCategory()">${btnLabel}</button>` +
    `<span class="scb-status" id="scb-status"></span>`;
  bar.style.display = '';
}

async function saveCurrentToCategory() {
  const sel = document.getElementById('scb-select');
  if (!sel) return;
  const status = document.getElementById('scb-status');
  const categoryId = sel.value || null;
  if (typeof Cloud?.librarySaveCurrent !== 'function') return;
  if (status) { status.textContent = '…'; status.style.color = 'var(--text-secondary)'; }
  try {
    await Cloud.librarySaveCurrent({ categoryId, skipAutoSaveCheck: true });
    // Bug 1（Blue 2026-06-29）：存完後自動切 filter 到新分類，避免使用者以為「資料不見了」。
    // 場景：user 在「未分類」view，把某筆設為「家人」→ 從未分類 list 消失 → user 困惑。
    // 改完自動切到「家人」view 並讓該筆出現於眼前。空分類（categoryId=null）則維持當前 filter。
    if (categoryId && typeof Cloud.setCategoryFilter === 'function') {
      Cloud.setCategoryFilter(categoryId);
    }
    if (status) {
      status.textContent = '✓ ' + t('save_cat_done');
      status.style.color = 'var(--positive)';
      setTimeout(() => { if (status) status.textContent = ''; }, 3000);
    }
  } catch (e) {
    console.error('saveCurrentToCategory failed', e);
    if (status) {
      status.textContent = '✕ ' + t('save_cat_failed');
      status.style.color = 'var(--danger)';
    }
  }
}

// 登入或登出後 categories 變動 → 重渲染分類列
if (typeof window !== 'undefined') {
  window.saveCurrentToCategory = saveCurrentToCategory;
  window.updateSaveCategoryBar  = updateSaveCategoryBar;
  window.updatePartnerBanner    = updatePartnerBanner;
  window.updateDailyFortune     = updateDailyFortune;
  window.addEventListener('aethnous-categories-updated', () => {
    updateSaveCategoryBar();
    updatePartnerBanner();
    updateDailyFortune();
  });
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
  renderMonthAxis();
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
        `<span class="chip-sub">${tGZ(l.stemBranch)}　${tPalaceName(l.palace)}</span>` +
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
        `<span class="chip-main">${tGZ(gz)}</span>` +
        `<span class="chip-sub">${y}</span>` +
      `</button>`;
    }).join('') +
    `</div>`;
  const act = el.querySelector('.chip.active');
  if (act) act.scrollIntoView({ block: 'nearest', inline: 'center' });
}

// ── 流月軸（汎天派順數法）：預設顯示該年十二個農曆月（正月…臘月）──
// 點某月 → 高亮該流月命宮的三方四正（沿用 selectedBranch 機制，銀灰線）
function renderMonthAxis() {
  const el = document.getElementById('month-axis');
  if (!el) return;
  const fd = S.flowData;
  const mingBranch = fd?.flowYearLifePalace?.branch;
  const yearStem   = fd?.flowYear?.stem;
  if (!mingBranch || !yearStem) { el.innerHTML = ''; return; }

  let chips = '';
  for (let m = 1; m <= 12; m++) {
    // 月干支：五虎遁月干 + 節氣月地支（正月=寅，順數）
    const stem = flowMonthStemOf(yearStem, m);
    const monthBranch = EARTHLY_BRANCHES[(EARTHLY_BRANCHES.indexOf('寅') + (m - 1)) % 12];
    const gz   = (stem || '') + monthBranch;
    // 流月命宮地支（順數法，供高亮與宮名顯示）
    const mingBr = flowMonthBranch(mingBranch, m);
    const palace = S.chartData?.palaces.find(p => p.branch === mingBr);
    const palName = palace ? tPalaceShort(palace.name) : '';
    const active = S.selectedBranch === mingBr;
    chips += `<button class="chip chip-month${active ? ' active' : ''}" onclick="gotoMonth(${m})">` +
      `<span class="chip-main">${tMonthName(m)}</span>` +
      `<span class="chip-sub">${tGZ(gz)}${palName ? '　' + palName : ''}</span>` +
    `</button>`;
  }
  el.innerHTML =
    `<span class="axis-label">${t('month_axis_label')}</span>` +
    `<div class="chips-scroll">${chips}</div>`;

  const act = el.querySelector('.chip.active');
  if (act) act.scrollIntoView({ block: 'nearest', inline: 'center' });
}

// 點流月 chip → 高亮該流月命宮三方四正 + 渲染十二宮「月X」標籤
//   （再點同月可取消；切到流年/大限軸時自動清空 monthMingBranch）
function gotoMonth(m) {
  const fd = S.flowData;
  const mingBranch = fd?.flowYearLifePalace?.branch;
  if (!mingBranch) return;
  const br = flowMonthBranch(mingBranch, m);
  if (!br) return;
  if (S.selectedBranch === br) {
    S.selectedBranch = null;
    S.monthMingBranch = null;
    stopTrineAnim();
    renderMonthAxis();
    renderAllCharts();
    return;
  }
  S.selectedBranch = br;
  S.monthMingBranch = br;
  S.dashOffset = 0;
  startTrineAnim();
  renderMonthAxis();
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
  S.selectedBranch = null; S.monthMingBranch = null; stopTrineAnim();
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
  hint.textContent = isEn() ? `${tGZ(gz)}　${start}〜${end}` : `${gz}年　${start}〜${end}`;
}

async function handleSubmit(opts) {
  const err = document.getElementById('form-err');
  // #7a（Blue 2026-06-30）：Chart 頁需登入才能起盤（雲端命例庫＋隱私一致）。
  // clientId 為空＝登入功能未啟用（純本機模式）時不擋，避免本地開發卡死。
  // 例外（Blue 2026-07-01）：從 engine landing 帶生辰參數深連結進來的訪客（opts.fromDeepLink）
  //   直接看盤、不擋登入 —— 順暢承接 index → chart「輸入生日即看盤」的整合流程。
  //   此路徑不會自動存命例（cloud 自動存本就需 signedIn），故不觸及任何人的 Drive 隱私。
  const fromDeepLink = !!(opts && opts.fromDeepLink);
  if (typeof Cloud !== 'undefined' && Cloud.clientId && !Cloud.signedIn && !fromDeepLink) {
    if (err) { err.textContent = t('login_required_cast'); err.style.display = 'block'; }
    if (typeof cloudSignIn === 'function') cloudSignIn();
    return;
  }
  // E1（Blue 2026-06-27）：若不是從命例載入觸發（_loadingFromLibrary 旗標）→ 清 editingId。
  // 防止使用者修改完 A 命例後，未明確結束就直接打新生辰 → autosave 把新資料蓋回 A。
  if (typeof Cloud !== 'undefined' && !Cloud._loadingFromLibrary) Cloud.editingId = null;
  const date   = document.getElementById('f-date').value;
  let   time   = document.getElementById('f-time').value;
  const gender = document.querySelector('input[name=g]:checked')?.value;
  const name   = document.getElementById('f-name').value.trim();
  const city   = document.getElementById('f-city')?.value.trim() || '';
  const yv     = document.getElementById('f-year').value.trim();

  // #4（Blue 2026-06-30）：不確定時辰 → 直接以午時(12:00)起盤，起盤後標示僅供參考。
  const unknownTime = document.getElementById('f-unknown-time')?.checked === true;
  if (unknownTime) time = '12:00';
  S.unknownTime = unknownTime;

  err.style.display = 'none';
  if (!date || !gender || (!unknownTime && !time)) {
    err.textContent = t('err_required');
    err.style.display = 'block'; return;
  }

  const mainYear = yv ? parseInt(yv) : new Date().getFullYear();
  const allYears = [mainYear];

  // 已定盤：勾選 → 輸入時間已是真太陽時，引擎不要再校正 → 不傳 city（API 跳過真太陽時校正）
  const chartSet = document.getElementById('f-chartset')?.checked !== false;
  const apiCity = chartSet ? '' : city;

  Object.assign(S, { birthDate:date, birthTime:time, gender, name, city, chartSet, currentYear:mainYear });

  document.getElementById('input-panel').style.display = 'none';
  document.getElementById('chart-area').style.display  = 'none';
  document.getElementById('loading').style.display     = 'block';

  try {
    const chartData = await apiChart(date, time, gender, apiCity);
    S.chartData = chartData;
    S.flowDataByYear = {};
    const flows = await Promise.all(allYears.map(y => apiFlow(date, time, gender, y, apiCity)));
    allYears.forEach((y, i) => { S.flowDataByYear[y] = flows[i]; });
    S.flowData = S.flowDataByYear[mainYear];

    document.getElementById('loading').style.display = 'none';
    document.getElementById('chart-area').style.display = 'block';

    S.yearBlocks = allYears.map(y => {
      const gz = getYearStem(y) + getYearBranch(y);
      return { year: y, gz, canvasId: `chart-canvas-${y}` };
    });

    updateMetaBar(); updateFlowBar();
    updateUncertainTimeNotice();
    renderViewModeBar(); renderAxes();
    buildChartBlocks();
    renderAllCharts();

    // Sprint 3：起盤成功 → 自動存入命例庫（cloud.js 提供；可由 UI 關閉）
    if (typeof librarySaveCurrent === 'function') await librarySaveCurrent();
    // Sprint 3.9 H4：渲染「儲存到分類」列（需在 librarySaveCurrent 後，才能反映 categoryId）
    updateSaveCategoryBar();

    // Sprint 3.8（Blue 2026-06-17）：配偶 sub-form 填寫 → 自動建第二盤 + 雙向串連
    if (partnerFieldsFilled()) {
      await saveAndLinkPartnerChart(gender);
    }
  } catch(e) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('input-panel').style.display = 'block';
    err.textContent = t('err_failed') + e.message; err.style.display = 'block';
  }
}

// ── 配偶 sub-form helpers (Sprint 3.8, Blue 2026-06-17) ─────────────────
// 起盤後若關係狀態為 PARTNER_LINKABLE_STATUSES + 配偶生日／時間填寫 → 自動
// 建立第二盤命例 + linkPartners 雙向綁定（owner-ext 載入時才綁，否則只存盤）
function partnerFieldsFilled() {
  const sub = document.getElementById('partner-fields');
  if (!sub || sub.style.display === 'none') return false;
  const pdate = document.getElementById('f2-date')?.value;
  const ptime = document.getElementById('f2-time')?.value;
  return !!(pdate && ptime);
}

async function saveAndLinkPartnerChart(mainGender) {
  const store = window.Cloud?.store;
  if (!store || !Array.isArray(store.charts)) return;

  const pdate = document.getElementById('f2-date').value;
  const ptime = document.getElementById('f2-time').value;
  const pcity = document.getElementById('f2-city')?.value.trim() || '';
  let pgender = document.querySelector('input[name=g2]:checked')?.value;
  // 配對類型 (異性／同性／不指定) → 性別 default
  if (!pgender) {
    const mt = document.getElementById('f-mt')?.value || 'hetero';
    if (mt === 'hetero') pgender = (mainGender === '男') ? '女' : '男';
    else if (mt === 'homo') pgender = mainGender;
    else return; // 不指定 + 沒勾性別 → 不建第二盤
  }
  const pname = document.getElementById('f2-name').value.trim();

  // 找主命主（剛被 librarySaveCurrent 寫入 store）
  const mainChart = store.charts.find(c =>
    c.date === S.birthDate && c.time === S.birthTime &&
    c.gender === S.gender && (c.name || '') === (S.name || ''));
  if (!mainChart) return;

  // 找或建配偶 chart entry
  let partnerChart = store.charts.find(c =>
    c.date === pdate && c.time === ptime &&
    c.gender === pgender && (c.name || '') === (pname || ''));
  const now = new Date().toISOString();
  if (!partnerChart) {
    const newId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    const pChartSet = document.getElementById('f2-chartset')?.checked !== false;
    partnerChart = {
      id: newId, name: pname, date: pdate, time: ptime, gender: pgender,
      city: pcity, chartSet: pChartSet,
      tags: [], notes: '', createdAt: now, updatedAt: now,
    };
    // 若 owner-ext 載入 → 補上 schema v3 欄位
    if (window.CloudExt) {
      partnerChart.categoryId = null;
      partnerChart.personalProfile = window.CloudExt.emptyProfile();
      partnerChart.partnerIds = [];
      partnerChart.formerPartnerIds = [];
    }
    store.charts.unshift(partnerChart);
  }

  // 雙向綁定（僅 owner-ext 載入時，CloudExt.linkPartners 存在）
  if (window.CloudExt?.linkPartners) {
    window.CloudExt.linkPartners(store, mainChart.id, partnerChart.id);
  }

  store.updatedAt = now;
  if (typeof window.saveLocalStore === 'function') window.saveLocalStore(store);
  // 再呼叫 librarySaveCurrent 觸發雲端 persistStore（store 已更新含配偶）
  if (typeof librarySaveCurrent === 'function') await librarySaveCurrent();
  if (typeof window.renderLibrary === 'function') window.renderLibrary();
}

// ── 合盤 button helpers（Sprint 3.9，Blue 2026-06-17 round 4）─────────
// 找到目前主命主在 store 內的 chart entry，回傳已綁定的 partner 命例（第一個）
function findCurrentPartnerChart() {
  const store = window.Cloud?.store;
  if (!store || !Array.isArray(store.charts)) return null;
  const me = store.charts.find(c =>
    c.date === S.birthDate && c.time === S.birthTime &&
    c.gender === S.gender && (c.name || '') === (S.name || ''));
  if (!me || !Array.isArray(me.partnerIds) || !me.partnerIds.length) return null;
  return store.charts.find(c => c.id === me.partnerIds[0]) || null;
}

function canOpenSynastry() {
  return !!findCurrentPartnerChart();
}

// 合盤頁 — Sprint 4 P0 已上線（/synastry.html）。優先以 cloud store id 帶入，
// 找不到 id（如剛起盤未存）時退回生辰參數，確保配偶 sub-form 直接起盤也能用。
function openSynastryWindow() {
  const partner = findCurrentPartnerChart();
  if (!partner) {
    alert(t('partner_required_for_synastry') || '需先綁定配偶／伴侶命例才能合盤');
    return;
  }
  const store = window.Cloud?.store;
  const me = store?.charts?.find(c =>
    c.date === S.birthDate && c.time === S.birthTime &&
    c.gender === S.gender && (c.name || '') === (S.name || ''));
  let url = '/synastry.html';
  if (me?.id && partner?.id) {
    url += `?selfId=${encodeURIComponent(me.id)}&partnerId=${encodeURIComponent(partner.id)}`;
  } else {
    const q = new URLSearchParams({
      date1: S.birthDate, time1: S.birthTime, gender1: S.gender,
      date2: partner.date, time2: partner.time, gender2: partner.gender,
    });
    if (S.city)         q.set('city1', S.city);
    if (partner.city)   q.set('city2', partner.city);
    if (S.name)         q.set('name1', S.name);
    if (partner.name)   q.set('name2', partner.name);
    if (S.chartSet === false)       q.set('chartSet1', '0');
    if (partner.chartSet === false) q.set('chartSet2', '0');
    url += '?' + q.toString();
  }
  window.open(url, '_blank', 'noopener');
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
    const gzDisp = isEn() ? tGZ(blk.gz) : `${blk.gz}年`;
    // 合盤 button：當 owner-ext 載入且當前命主有 partnerIds 時顯示
    const synastryBtn = canOpenSynastry()
      ? `<button onclick="openSynastryWindow()">${t('btn_synastry')}</button>`
      : '';
    div.innerHTML = `
      <div class="chart-block-title">${isMain ? t('block_main') : t('block_extra')}　${blk.year}　${gzDisp}　${start}〜${end}</div>
      <div class="canvas-wrap"><canvas id="${blk.canvasId}"></canvas></div>
      <div class="chart-block-actions">
        <button onclick="exportPNGForYear(${blk.year})">${t('btn_export')} ${blk.year} ${t('btn_export_suffix')}</button>
        ${synastryBtn}
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
  link.download = `${n}${S.birthDate}_${t('file_flow')}${year}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function resetChart() {
  stopTrineAnim();
  S.selectedBranch = null;
  S.chartData=null; S.flowData=null; S.flowDataByYear={}; S.yearBlocks=[];
  document.getElementById('chart-area').style.display  = 'none';
  document.getElementById('input-panel').style.display = 'block';
  // 切換命盤時清 fortune cache，確保新命主重新拉取（不沿用前一人的快取內容）
  _dfFetchKey = null;
  const dfBox = document.getElementById('daily-fortune');
  if (dfBox) { dfBox.innerHTML = ''; dfBox.style.display = 'none'; dfBox.dataset.rendered = ''; }
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
// CITY_DATA 升級（Blue 2026-06-17 round 5）：台灣細分到 22 直轄市/縣市，所有
// 城市加上 enName；外國項目於 dropdown 中只顯示英文，台灣項目雙語顯示。
const CITY_DATA = [
  // 台灣（直轄市 + 縣市）
  { name:'台北市',     enName:'Taipei City',         code:'TPE', region:'台灣', tz:8 },
  { name:'新北市',     enName:'New Taipei City',     code:'',    region:'台灣', tz:8 },
  { name:'桃園市',     enName:'Taoyuan City',        code:'TYN', region:'台灣', tz:8 },
  { name:'台中市',     enName:'Taichung City',       code:'RMQ', region:'台灣', tz:8 },
  { name:'台南市',     enName:'Tainan City',         code:'TNN', region:'台灣', tz:8 },
  { name:'高雄市',     enName:'Kaohsiung City',      code:'KHH', region:'台灣', tz:8 },
  { name:'基隆市',     enName:'Keelung City',        code:'',    region:'台灣', tz:8 },
  { name:'新竹市',     enName:'Hsinchu City',        code:'',    region:'台灣', tz:8 },
  { name:'嘉義市',     enName:'Chiayi City',         code:'',    region:'台灣', tz:8 },
  { name:'新竹縣',     enName:'Hsinchu County',      code:'',    region:'台灣', tz:8 },
  { name:'苗栗縣',     enName:'Miaoli County',       code:'',    region:'台灣', tz:8 },
  { name:'彰化縣',     enName:'Changhua County',     code:'',    region:'台灣', tz:8 },
  { name:'南投縣',     enName:'Nantou County',       code:'',    region:'台灣', tz:8 },
  { name:'雲林縣',     enName:'Yunlin County',       code:'',    region:'台灣', tz:8 },
  { name:'嘉義縣',     enName:'Chiayi County',       code:'',    region:'台灣', tz:8 },
  { name:'屏東縣',     enName:'Pingtung County',     code:'',    region:'台灣', tz:8 },
  { name:'宜蘭縣',     enName:'Yilan County',        code:'',    region:'台灣', tz:8 },
  { name:'花蓮縣',     enName:'Hualien County',      code:'HUN', region:'台灣', tz:8 },
  { name:'台東縣',     enName:'Taitung County',      code:'TTT', region:'台灣', tz:8 },
  { name:'澎湖縣',     enName:'Penghu County',       code:'MZG', region:'台灣', tz:8 },
  { name:'金門縣',     enName:'Kinmen County',       code:'KNH', region:'台灣', tz:8 },
  { name:'連江縣',     enName:'Lienchiang County',   code:'',    region:'台灣', tz:8 },
  // 港澳
  { name:'香港', enName:'Hong Kong', code:'HKG', region:'香港', tz:8 },
  { name:'澳門', enName:'Macau',     code:'MFM', region:'澳門', tz:8 },
  // 中國
  { name:'上海', enName:'Shanghai',  code:'PVG', region:'中國', tz:8 },
  { name:'北京', enName:'Beijing',   code:'PEK', region:'中國', tz:8 },
  { name:'廣州', enName:'Guangzhou', code:'CAN', region:'中國', tz:8 },
  { name:'深圳', enName:'Shenzhen',  code:'SZX', region:'中國', tz:8 },
  { name:'成都', enName:'Chengdu',   code:'CTU', region:'中國', tz:8 },
  { name:'重慶', enName:'Chongqing', code:'CKG', region:'中國', tz:8 },
  { name:'武漢', enName:'Wuhan',     code:'WUH', region:'中國', tz:8 },
  // 韓國
  { name:'首爾', enName:'Seoul', code:'ICN', region:'韓國', tz:9 },
  { name:'釜山', enName:'Busan', code:'PUS', region:'韓國', tz:9 },
  // 日本
  { name:'東京', enName:'Tokyo', code:'NRT', region:'日本', tz:9 },
  { name:'大阪', enName:'Osaka', code:'KIX', region:'日本', tz:9 },
  // 東南亞
  { name:'曼谷',    enName:'Bangkok',       code:'BKK', region:'泰國',     tz:7 },
  { name:'新加坡',  enName:'Singapore',     code:'SIN', region:'新加坡',   tz:8 },
  { name:'吉隆坡',  enName:'Kuala Lumpur',  code:'KUL', region:'馬來西亞', tz:8 },
  { name:'胡志明市',enName:'Ho Chi Minh City', code:'SGN', region:'越南',  tz:7 },
  { name:'河內',    enName:'Hanoi',         code:'HAN', region:'越南',     tz:7 },
  // 北美
  { name:'洛杉磯', enName:'Los Angeles', code:'LAX', region:'美國',   tz:-8 },
  { name:'紐約',   enName:'New York',    code:'JFK', region:'美國',   tz:-5 },
  { name:'多倫多', enName:'Toronto',     code:'YYZ', region:'加拿大', tz:-5 },
  // 歐洲
  { name:'倫敦', enName:'London', code:'LHR', region:'英國', tz:0 },
  { name:'巴黎', enName:'Paris',  code:'CDG', region:'法國', tz:1 },
];

// 台灣項目於 dropdown 雙語顯示「EnName / 中文」；外國項目只顯示 EnName
function isTwCity(c) { return c.region === '台灣'; }
function cityDisplayLabel(c) {
  if (!c.enName) return c.name;
  return isTwCity(c) ? `${c.enName} / ${c.name}` : c.enName;
}

// 機場代號反查 → 城市名
const CODE_MAP = {};
CITY_DATA.forEach(c => { if (c.code) CODE_MAP[c.code.toUpperCase()] = c.name; });

function searchCities(q) {
  if (!q) return [];
  const uq = q.toUpperCase().trim();
  const lqRaw = q.toLowerCase().trim();
  // 機場代號 startsWith 優先
  const byCode = CITY_DATA.filter(c => c.code && c.code.toUpperCase().startsWith(uq));
  // 英文名 startsWith（用於 Blue 輸入 "Kao" → Kaohsiung 場景）
  const byEnStart = CITY_DATA.filter(c =>
    !byCode.includes(c) && c.enName && c.enName.toLowerCase().startsWith(lqRaw));
  // 中文名 includes（台北市/新北市的「台北」也能找到雙北）
  const byZhName = CITY_DATA.filter(c =>
    !byCode.includes(c) && !byEnStart.includes(c) && c.name.includes(lqRaw));
  // 英文名 includes（fallback；如「pei」找 Taipei）
  const byEnIncl = CITY_DATA.filter(c =>
    !byCode.includes(c) && !byEnStart.includes(c) && !byZhName.includes(c) &&
    c.enName && c.enName.toLowerCase().includes(lqRaw));
  // region 包含（最後排序）
  const byRegion = CITY_DATA.filter(c =>
    !byCode.includes(c) && !byEnStart.includes(c) && !byZhName.includes(c) &&
    !byEnIncl.includes(c) && c.region.includes(lqRaw));
  return [...byCode, ...byEnStart, ...byZhName, ...byEnIncl, ...byRegion].slice(0, 10);
}

// 通用 dropdown render：dropdownEl 指定哪個 dropdown 容器；ctx 持有 activeIdx
function renderDropdownInto(dropdownEl, items, ctx) {
  if (!items.length) { dropdownEl.classList.remove('open'); return; }
  dropdownEl.innerHTML = items.map((c, i) => {
    const tzStr = c.tz >= 0 ? `UTC+${c.tz}` : `UTC${c.tz}`;
    const label = cityDisplayLabel(c);
    return `<div class="city-opt${i === ctx.activeIdx ? ' active' : ''}" data-name="${c.name}">
      <span>${label} <span style="color:#aaa;font-size:11px">${c.region}</span></span>
      <span>${c.code ? `<span class="city-opt-code">${c.code}</span>` : ''}<span class="city-opt-tz">${tzStr}</span></span>
    </div>`;
  }).join('');
  dropdownEl.classList.add('open');
  dropdownEl.querySelectorAll('.city-opt').forEach(el => {
    el.addEventListener('mousedown', e => {
      e.preventDefault();
      ctx.inputEl.value = el.dataset.name;
      dropdownEl.classList.remove('open');
      ctx.items = []; ctx.activeIdx = -1;
    });
  });
}

// T2（Blue 2026-06-30）：城市欄預設「台灣」為佔位字 — 聚焦即清空，避免輸入接在預設後面
// （台灣ICN）；留空 blur 時還原。「台灣」不在 CITY_LONGITUDES，留作預設＝不做真太陽時校正。
const DEFAULT_CITY = '台灣';

// 通用 autocomplete 綁定：套用主命主 + 配偶 sub-form
function bindCityAutocomplete(inputId, dropdownId) {
  const inp = document.getElementById(inputId);
  const dd  = document.getElementById(dropdownId);
  if (!inp || !dd) return;
  const ctx = { items: [], activeIdx: -1, inputEl: inp };

  inp.addEventListener('input', () => {
    const q = inp.value.trim();
    // 純 3 字母大寫 → 直接轉成城市名
    if (/^[A-Za-z]{3}$/.test(q) && CODE_MAP[q.toUpperCase()]) {
      inp.value = CODE_MAP[q.toUpperCase()];
      dd.classList.remove('open');
      return;
    }
    ctx.items = searchCities(q);
    ctx.activeIdx = -1;
    renderDropdownInto(dd, ctx.items, ctx);
  });

  inp.addEventListener('keydown', e => {
    if (!dd.classList.contains('open')) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      ctx.activeIdx = Math.min(ctx.activeIdx + 1, ctx.items.length - 1);
      renderDropdownInto(dd, ctx.items, ctx);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      ctx.activeIdx = Math.max(ctx.activeIdx - 1, -1);
      renderDropdownInto(dd, ctx.items, ctx);
    } else if (e.key === 'Enter' && ctx.activeIdx >= 0) {
      e.preventDefault();
      inp.value = ctx.items[ctx.activeIdx].name;
      dd.classList.remove('open');
      ctx.items = []; ctx.activeIdx = -1;
    } else if (e.key === 'Escape') {
      dd.classList.remove('open');
    }
  });

  inp.addEventListener('blur', () => {
    setTimeout(() => {
      dd.classList.remove('open');
      if (inp.value.trim() === '') inp.value = DEFAULT_CITY;  // T2：留空還原預設
    }, 150);
  });

  inp.addEventListener('focus', () => {
    // T2：聚焦時若仍是預設「台灣」佔位字 → 清空，讓輸入直接取代（不再前綴殘留）
    if (inp.value.trim() === DEFAULT_CITY) { inp.value = ''; return; }
    const q = inp.value.trim();
    if (q) {
      ctx.items = searchCities(q);
      renderDropdownInto(dd, ctx.items, ctx);
    }
  });
}

// 啟動：主命主 + 配偶兩組 city autocomplete
document.addEventListener('DOMContentLoaded', () => {
  bindCityAutocomplete('f-city', 'city-dropdown');
  bindCityAutocomplete('f2-city', 'f2-city-dropdown');
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
    // 深連結（engine landing 帶參數）→ 直接起盤看盤，不擋登入（見 handleSubmit #7a 例外）
    handleSubmit({ fromDeepLink: true });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fill);
  } else {
    fill();
  }
})();
