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

// 主入口：renderSynastryMatrix(payload, chartA, chartB)
window.renderSynastryMatrix = function renderSynastryMatrix(payload, chartA, chartB) {
  const svg = document.getElementById('syn-matrix-svg');
  if (!svg || !payload) return;
  const canvasA = document.getElementById('syn-canvas-a');
  const canvasB = document.getElementById('syn-canvas-b');
  if (!canvasA || !canvasB) return;

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

  const pathHTMLs = [];

  // ── A→B: chartA 的生年化X + 大限化X → B 的 targetPalace ─────
  for (const entry of (payload.chart1BirthYearToChart2 || [])) {
    if (!entry.targetPalaceName || !entry.star) continue;
    const srcPal = _findSourcePalace(chartA, entry.star);
    if (!srcPal) continue;
    const from = _palaceCenterRelative(canvasA, srcPal.branch);
    const tgtPal = chartB.palaces.find(p => p.name === entry.targetPalaceName);
    if (!tgtPal) continue;
    const to = _palaceCenterRelative(canvasB, tgtPal.branch);
    if (!from || !to) continue;
    const color = SYN_MUT_COLOR[entry.type] || '#888';
    pathHTMLs.push(_buildPath(from, to, color, false, 'syn-arrow-' + entry.type, entry.note));
  }
  for (const entry of (payload.chart1CurrentDecadeToChart2 || [])) {
    if (!entry.targetPalaceName || !entry.star) continue;
    const srcPal = _findSourcePalace(chartA, entry.star);
    if (!srcPal) continue;
    const from = _palaceCenterRelative(canvasA, srcPal.branch);
    const tgtPal = chartB.palaces.find(p => p.name === entry.targetPalaceName);
    if (!tgtPal) continue;
    const to = _palaceCenterRelative(canvasB, tgtPal.branch);
    if (!from || !to) continue;
    const color = SYN_MUT_COLOR[entry.type] || '#888';
    pathHTMLs.push(_buildPath(from, to, color, false, 'syn-arrow-' + entry.type, entry.note));
  }

  // ── B→A: chartB 的生年化X + 大限化X → A 的 targetPalace ─────
  for (const entry of (payload.chart2BirthYearToChart1 || [])) {
    if (!entry.targetPalaceName || !entry.star) continue;
    const srcPal = _findSourcePalace(chartB, entry.star);
    if (!srcPal) continue;
    const from = _palaceCenterRelative(canvasB, srcPal.branch);
    const tgtPal = chartA.palaces.find(p => p.name === entry.targetPalaceName);
    if (!tgtPal) continue;
    const to = _palaceCenterRelative(canvasA, tgtPal.branch);
    if (!from || !to) continue;
    const color = SYN_MUT_COLOR[entry.type] || '#888';
    pathHTMLs.push(_buildPath(from, to, color, true, 'syn-arrow-' + entry.type, entry.note));
  }
  for (const entry of (payload.chart2CurrentDecadeToChart1 || [])) {
    if (!entry.targetPalaceName || !entry.star) continue;
    const srcPal = _findSourcePalace(chartB, entry.star);
    if (!srcPal) continue;
    const from = _palaceCenterRelative(canvasB, srcPal.branch);
    const tgtPal = chartA.palaces.find(p => p.name === entry.targetPalaceName);
    if (!tgtPal) continue;
    const to = _palaceCenterRelative(canvasA, tgtPal.branch);
    if (!from || !to) continue;
    const color = SYN_MUT_COLOR[entry.type] || '#888';
    pathHTMLs.push(_buildPath(from, to, color, true, 'syn-arrow-' + entry.type, entry.note));
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
