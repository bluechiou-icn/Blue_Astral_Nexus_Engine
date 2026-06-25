// ════════════════════════════════════════════════════════
// synastry-matrix.js — 中央交叉飛化矩陣 SVG 渲染
//   從左盤 (canvas-a) 的「飛化來源」對應宮位中心點 → 中央 SVG 中段
//   再往右盤 (canvas-b) 的「飛化目標」宮位中心點，畫 Bezier 連線
//   B→A 方向反過來
//   四化顏色：化祿綠 / 化權藍 / 化科紫 / 化忌紅
//   A→B 實線、B→A 虛線；箭頭 marker-end
//   Sprint 4 P0，依 ClaudeCode_20260617_4_Sprint4_Spec.md
// ════════════════════════════════════════════════════════

const SYN_MUT_COLOR = {
  '化祿': '#16a34a',
  '化權': '#2563eb',
  '化科': '#7c3aed',
  '化忌': '#dc2626',
};

// ── 飛化線篩選 state（Blue 2026-06-25 #5）─────────────────
//   預設兩集合皆空 → 不畫任何線。user 勾選 direction × mutagen 才畫對應線。
//   direction 集合：'ab' | 'ba' | 'same' | 'rev'
//   mutagen 集合：'化祿' | '化權' | '化科' | '化忌'
window.SYN_FILTER = window.SYN_FILTER || {
  directions: new Set(),
  mutagens:   new Set(),
};

// 「祿/權/科 ↔ 忌」相生相剋：用於反向偵測（Blue 2026-06-25 #5）
const SYN_OPPOSITE_TYPE = {
  '化祿': '化忌', '化權': '化忌', '化科': '化忌', '化忌': '化祿',
};

const SYN_SOURCE_LABEL = {
  birthYear:     '生年',
  currentDecade: '大限',
};

// 取得 canvas 內某宮位中心點相對於 SVG 容器的座標
//   canvas 是被 max-width CSS 縮放過的，所以要用 getBoundingClientRect()
//   再扣掉 svg container 的 rect 起點。
function _palaceCenterRelative(canvas, branch /*, svgRect */) {
  if (typeof BRANCH_POS === 'undefined' || !BRANCH_POS[branch]) return null;
  const cRect = canvas.getBoundingClientRect();
  const scale = cRect.width / BASE;
  const [row, col] = BRANCH_POS[branch];
  // document 全域座標 = viewport + scroll
  const cx = cRect.left + window.scrollX + (col * CELL + CELL / 2) * scale;
  const cy = cRect.top  + window.scrollY + (row * CELL + CELL / 2) * scale;
  return { x: cx, y: cy };
}

// 找來源宮位：A 的「生年化X」星 落在 A 命盤的哪個宮（不是 B）
//   引擎輸出的 cross-flying 物件 = { stem, source, type, star, targetPalaceName,
//   targetStemBranch, note }；targetPalaceName 是 B 的宮位（A→B 方向）
//   來源宮（A 側）要自己查：找 chartA.palaces 含這顆 star 的宮
function _findSourcePalace(chart, star) {
  if (!chart || !star) return null;
  return chart.palaces.find(p =>
    (p.majorStars || []).some(s => s.name === star) ||
    (p.minorStars || []).some(s => s.name === star)
  ) || null;
}

// 畫一條 Bezier 飛化線
//   from = 來源宮中心點 (相對 SVG)，to = 目標宮中心點
//   color = 四化顏色，dashed = true 為 B→A 虛線
function _buildPath(from, to, color, dashed, markerId, tooltipText) {
  // 中央 Bezier：control points 拉到雙方中間區域，曲線略弧
  const midX = (from.x + to.x) / 2;
  const dx = Math.abs(to.x - from.x);
  const offset = Math.min(80, dx * 0.3);
  const c1 = { x: from.x + (to.x > from.x ? offset : -offset), y: from.y };
  const c2 = { x: to.x   + (to.x > from.x ? -offset : offset), y: to.y };
  const d = `M ${from.x},${from.y} C ${c1.x},${c1.y} ${c2.x},${c2.y} ${to.x},${to.y}`;
  const dashAttr = dashed ? `stroke-dasharray="6 4"` : '';
  // pointer-events 開放，但 stroke 細不易 hover；故另疊一條透明 stroke-width:14 的同路徑作 hit 區
  const safeTip = (tooltipText || '').replace(/"/g, '&quot;').replace(/\n/g, '&#10;');
  return `
    <path d="${d}" fill="none" stroke="transparent" stroke-width="14"
          class="syn-arrow-hit" data-tip="${safeTip}"
          style="pointer-events:stroke;cursor:help;"></path>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="1.6"
          marker-end="url(#${markerId})" ${dashAttr} opacity="0.85"
          style="pointer-events:none;"></path>
  `;
}

// 主入口：renderSynastryMatrix(payload, chartA, chartB, nameA?, nameB?)
window.renderSynastryMatrix = function renderSynastryMatrix(payload, chartA, chartB, nameA, nameB) {
  const svg = document.getElementById('syn-matrix-svg');
  if (!svg || !payload) return;
  const canvasA = document.getElementById('syn-canvas-a');
  const canvasB = document.getElementById('syn-canvas-b');
  if (!canvasA || !canvasB) return;

  // 真名 fallback（無提供姓名時用 A / B）
  nameA = nameA || 'A';
  nameB = nameB || 'B';

  // SVG 容器要覆蓋整頁雙盤 → 用 absolute 定位於 body，跟著 scroll
  //   座標系：document 全域 pixel；箭頭起終點用 getBoundingClientRect + scroll offset
  //   每次 rerender（含 resize、語系切換）時清空 + 重設 viewBox
  //   把 svg 從原本 .syn-matrix 容器移到 body root，避免父層 overflow 裁切
  if (svg.parentElement !== document.body) document.body.appendChild(svg);
  const dw = Math.max(document.documentElement.scrollWidth, window.innerWidth);
  const dh = Math.max(document.documentElement.scrollHeight, window.innerHeight);
  svg.style.position = 'absolute';
  svg.style.top = '0';
  svg.style.left = '0';
  svg.style.width = dw + 'px';
  svg.style.height = dh + 'px';
  svg.style.pointerEvents = 'none';
  svg.style.zIndex = '50';
  svg.setAttribute('viewBox', `0 0 ${dw} ${dh}`);
  svg.setAttribute('preserveAspectRatio', 'none');

  // marker defs：四化各一支箭頭
  const markers = Object.entries(SYN_MUT_COLOR).map(([type, color]) => {
    const id = 'syn-arrow-' + type;
    return `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="${color}" />
            </marker>`;
  }).join('');

  // 偽 viewport reference rect（不扣 offset，因為 svg 已是 fullscreen fixed）
  // svgRect 已不使用（_palaceCenterRelative 直接用 document 全域座標）

  // ── 1. 全部 entries 平攤成統一物件（含 dir/source/srcChart/tgtChart/真名）─────
  const entries = [];
  const pushEntry = (raw, dir, source) => {
    if (!raw?.targetPalaceName || !raw?.star) return;
    entries.push({
      dir, source, type: raw.type, star: raw.star,
      srcChart:  dir === 'ab' ? chartA  : chartB,
      tgtChart:  dir === 'ab' ? chartB  : chartA,
      srcCanvas: dir === 'ab' ? canvasA : canvasB,
      tgtCanvas: dir === 'ab' ? canvasB : canvasA,
      srcName:   dir === 'ab' ? nameA   : nameB,
      tgtName:   dir === 'ab' ? nameB   : nameA,
      targetPalaceName: raw.targetPalaceName,
      rawNote: raw.note || '',
    });
  };
  (payload.chart1BirthYearToChart2     || []).forEach(e => pushEntry(e, 'ab', 'birthYear'));
  (payload.chart1CurrentDecadeToChart2 || []).forEach(e => pushEntry(e, 'ab', 'currentDecade'));
  (payload.chart2BirthYearToChart1     || []).forEach(e => pushEntry(e, 'ba', 'birthYear'));
  (payload.chart2CurrentDecadeToChart1 || []).forEach(e => pushEntry(e, 'ba', 'currentDecade'));

  // ── 2. 同向 / 反向偵測（per-type, cross-direction）─────────────
  //   同向 = 同一個 mutagen type 在 A→B 跟 B→A 都出現過（資源/壓力雙向呼應）
  //   反向 = 一邊送 祿/權/科，另一邊回送 忌（或反之）— 不對稱關係
  const typesAB = new Set(entries.filter(e => e.dir === 'ab').map(e => e.type));
  const typesBA = new Set(entries.filter(e => e.dir === 'ba').map(e => e.type));
  for (const e of entries) {
    const otherSet = e.dir === 'ab' ? typesBA : typesAB;
    e.same = otherSet.has(e.type);
    const opp = SYN_OPPOSITE_TYPE[e.type];
    e.rev = !!(opp && otherSet.has(opp));
  }

  // ── 3. 套用 filter（預設兩集合皆空 → 0 條線）─────────────────
  const F = window.SYN_FILTER || { directions: new Set(), mutagens: new Set() };
  const filtered = entries.filter(e => {
    if (!F.mutagens.has(e.type)) return false;
    for (const d of F.directions) {
      if (d === 'ab'   && e.dir === 'ab') return true;
      if (d === 'ba'   && e.dir === 'ba') return true;
      if (d === 'same' && e.same)         return true;
      if (d === 'rev'  && e.rev)          return true;
    }
    return false;
  });

  // ── 4. 畫每條飛化線 + 組真名 tooltip ─────────────────────────
  const pathHTMLs = [];
  for (const e of filtered) {
    const srcPal = _findSourcePalace(e.srcChart, e.star);
    if (!srcPal) continue;
    const from = _palaceCenterRelative(e.srcCanvas, srcPal.branch);
    const tgtPal = e.tgtChart.palaces.find(p => p.name === e.targetPalaceName);
    if (!tgtPal) continue;
    const to = _palaceCenterRelative(e.tgtCanvas, tgtPal.branch);
    if (!from || !to) continue;
    const color  = SYN_MUT_COLOR[e.type] || '#888';
    const dashed = e.dir === 'ba';
    const srcLabel = SYN_SOURCE_LABEL[e.source] || e.source;
    // Blue 2026-06-25 #5：tooltip 用真名 + 明確標示「生年/大限」、星曜全名、雙邊宮位
    const tooltip =
      `${e.srcName}（${srcLabel}）　${e.star}${e.type}\n` +
      `　源：${e.srcName} ${srcPal.name}（${srcPal.branch || ''}）\n` +
      `　→ 入 ${e.tgtName} ${e.targetPalaceName}（本命宮位）` +
      (e.rawNote ? `\n　備註：${e.rawNote}` : '');
    pathHTMLs.push(_buildPath(from, to, color, dashed, 'syn-arrow-' + e.type, tooltip));
  }

  svg.innerHTML = `<defs>${markers}</defs>${pathHTMLs.join('')}`;

  // hit 區 hover tooltip
  //   svg 整體 pointer-events:none，個別 .syn-arrow-hit path 用 inline style
  //   pointer-events:stroke 啟用（透明粗線當 hit box，下方 toolbar 可正常點）
  const tip = document.getElementById('syn-matrix-tooltip');
  if (!tip) return;
  svg.querySelectorAll('.syn-arrow-hit').forEach(el => {
    el.addEventListener('mouseenter', (e) => {
      tip.textContent = el.dataset.tip || '';
      tip.style.display = 'block';
    });
    el.addEventListener('mousemove', (e) => {
      const w = 270, h = 70;
      let x = e.clientX + 14, y = e.clientY + 14;
      if (x + w > window.innerWidth)  x = e.clientX - w - 14;
      if (y + h > window.innerHeight) y = e.clientY - h - 14;
      tip.style.left = Math.max(8, x) + 'px';
      tip.style.top  = Math.max(8, y) + 'px';
    });
    el.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
  });
};
