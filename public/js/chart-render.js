// ════════════════════════════════════════════════════════
// CANVAS HELPERS
// ════════════════════════════════════════════════════════

function setupCanvas(canvas) {
  canvas.width  = BASE * DPR;
  canvas.height = BASE * DPR;
  // 使用實際父容器 (canvas-wrap) 寬度，避免被 body / chart-block padding 推出邊界
  const wrap   = canvas.parentElement;
  const wrapW  = wrap ? wrap.clientWidth : (window.innerWidth - 32);
  const disp   = Math.min(BASE, wrapW);
  canvas.style.width  = disp + 'px';
  canvas.style.height = disp + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);
  return ctx;
}

// ════════════════════════════════════════════════════════
// GRID
// ════════════════════════════════════════════════════════

function drawGrid(ctx) {
  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, BASE, BASE);

  // Outer border
  ctx.strokeStyle = '#b0aea8'; ctx.lineWidth = 1.5;
  ctx.strokeRect(0.75, 0.75, BASE-1.5, BASE-1.5);

  // Inner grid lines
  ctx.strokeStyle = '#cccccc'; ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(i*CELL,0); ctx.lineTo(i*CELL,BASE); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,i*CELL); ctx.lineTo(BASE,i*CELL); ctx.stroke();
  }

  // Center 2×2 slightly different background
  ctx.fillStyle = '#f9f8f4';
  ctx.fillRect(CELL, CELL, 2*CELL, 2*CELL);
  ctx.strokeStyle = '#b8b6b0'; ctx.lineWidth = 1;
  ctx.strokeRect(CELL+0.5, CELL+0.5, 2*CELL-1, 2*CELL-1);
}

// ════════════════════════════════════════════════════════
// PALACE CELL
// ════════════════════════════════════════════════════════

// Star unified font size (主/輔/煞/小 all same size, only color differs)
const STAR_FS_BASE = 28;

// Draw one star as a vertical column.
// centerX is the horizontal CENTER of this star's column.
// fsOverride lets caller specify a smaller font when many stars cramp the cell.
// isBorrowed: true → wrap name in dashed gray box (借星標記)
function drawStarColumn(ctx, centerX, top, bottom, name, brightness, mutagens, color, isMajor, fsOverride, isBorrowed) {
  const FS = fsOverride || STAR_FS_BASE;
  const lineH = FS + 3;
  let y = top;

  ctx.textAlign = 'center';

  // 借星虛線方框（圍住星名 + 亮度）
  if (isBorrowed) {
    const totalChars = name.length + (brightness ? brightness.length : 0);
    const boxH = totalChars * lineH + 6;
    ctx.save();
    ctx.strokeStyle = '#999';
    ctx.setLineDash([3, 2]);
    ctx.lineWidth = 1;
    ctx.strokeRect(centerX - FS/2 - 2, y - 2, FS + 4, boxH);
    ctx.restore();
  }

  // Star name (vertical char-by-char) — bold for major stars
  ctx.font = `${isMajor ? 'bold ' : ''}${FS}px ${FONT}`;
  ctx.fillStyle = color;
  for (const ch of name) {
    if (y + FS > bottom) { ctx.textAlign='left'; return; }
    ctx.fillText(ch, centerX, y + FS);
    y += lineH;
  }

  // Brightness (color by brightness, slightly smaller)
  if (brightness) {
    y += 2;
    const bFS = Math.max(FS - 2, 16);
    ctx.font = `${bFS}px ${FONT}`;
    ctx.fillStyle = BRIGHT_CLR[brightness] || '#666';
    for (const ch of brightness) {
      if (y + bFS > bottom) { ctx.textAlign='left'; return; }
      ctx.fillText(ch, centerX, y + bFS);
      y += bFS + 2;
    }
  }

  // Mutagen badges - 顏色按來源（生年紅/大限綠/流年藍），實心方框 + 白字
  // 借星：四化方塊也轉灰 + 虛線外框
  const mFS = Math.max(FS - 4, 18);
  for (const mu of mutagens) {
    if (y + mFS + 2 > bottom) break;
    y += 3;
    const palette = MU_BY_SRC[mu.src]; if (!palette) continue;
    const key = MU_KEY[mu.type]; if (!key) continue;
    const bw = mFS + 2, bh = mFS + 2;
    const bx = centerX - bw/2;

    if (isBorrowed) {
      // 灰底 + 虛線框
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(bx, y, bw, bh);
      ctx.save();
      ctx.strokeStyle = '#9a9a9a';
      ctx.setLineDash([2, 2]);
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 0.5, y + 0.5, bw - 1, bh - 1);
      ctx.restore();
      ctx.fillStyle = '#9a9a9a';  // 與借星名同色
    } else {
      ctx.fillStyle = palette.bg;
      ctx.fillRect(bx, y, bw, bh);
      ctx.fillStyle = palette.fg;
    }
    ctx.font = `bold ${mFS}px ${FONT}`;
    ctx.fillText(key, centerX, y + bh - 4);
    y += bh + 2;
  }

  ctx.textAlign = 'left';
}

// 流年吉凶星顏色：流羊/流陀為凶星(紅)，其他為輔星(紫)/小星(淺藍)
const FLOW_TRANS_COLOR = {
  '流祿': '#0a7f5f',   // 祿存色 深綠
  '流羊': CLR_KILL,
  '流陀': CLR_KILL,
  '流馬': '#7a5230',   // 棕
  '流昌': CLR_AUX,
  '流曲': CLR_AUX,
  '流魁': '#b8860b',   // 暗金
  '流鉞': '#b8860b',
};

// 在主星下方畫一排：流年吉凶星（大限四化已透過星旁綠底徽章顯示）
// 字體 = STAR_FS_BASE * 0.5 = 14px
function drawTransientRow(ctx, cx, cy, palace, decadeMu, flowTrans, yTop, rowH) {
  const labels = [];
  // 流年吉凶星（依宮位地支）— 大限四化已透過星旁綠底徽章顯示，此排只放流年凶吉星
  for (const t of flowTrans) {
    labels.push({ text: t, color: FLOW_TRANS_COLOR[t] || '#444', bg: null });
  }
  if (!labels.length) return;

  let FS = Math.round(STAR_FS_BASE * 0.5);  // 14px = 主星 50%
  const padX = 3, gap = 4;

  // 量測寬度；超過則縮字
  ctx.font = `bold ${FS}px ${FONT}`;
  let widths = labels.map(l => ctx.measureText(l.text).width + (l.bg ? padX*2 : 0));
  let total  = widths.reduce((a,b) => a+b, 0) + gap * (labels.length - 1);
  const maxW = CELL - 2*PAD;
  if (total > maxW) {
    FS = Math.max(10, Math.floor(FS * maxW / total));
    ctx.font = `bold ${FS}px ${FONT}`;
    widths = labels.map(l => ctx.measureText(l.text).width + (l.bg ? padX*2 : 0));
    total  = widths.reduce((a,b) => a+b, 0) + gap * (labels.length - 1);
  }

  let x = cx + (CELL - total) / 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (let i = 0; i < labels.length; i++) {
    const l = labels[i];
    if (l.bg) {
      ctx.fillStyle = l.bg;
      ctx.fillRect(x, yTop, widths[i], FS + 2);
      ctx.fillStyle = l.color;
      ctx.fillText(l.text, x + padX, yTop + 1);
    } else {
      ctx.fillStyle = l.color;
      ctx.fillText(l.text, x, yTop + 1);
    }
    x += widths[i] + gap;
  }
  ctx.textBaseline = 'alphabetic';
}

function drawPalace(ctx, palace, row, col, opts) {
  const { muMap, decadeMing, flowMing, minorLimPalace,
          origPalace, bodyPalace, birthYear,
          flowYearStr, flowYearGZ } = opts;
  const cx = col * CELL, cy = row * CELL;
  const hasFlow = !!(flowMing);
  // 疊盤標記層：流年或大限其一存在即顯示（檢視模式「本命＋大限」只有 decadeMing）
  const hasOverlay = !!(flowMing || decadeMing);

  const isFlowMing = hasFlow && palace.name === flowMing;
  const isMinorLim = hasFlow && palace.name === minorLimPalace;
  // 大限命宮：在「本命＋大限」模式（無流年層）時以深綠雙線高亮
  const isDecadeMingOnly = !hasFlow && decadeMing && palace.name === decadeMing;

  // ── Background ──
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx+1, cy+1, CELL-2, CELL-2);

  // ── 流年命宮：整個宮格金色雙線高亮邊框 ──
  if (isFlowMing) {
    ctx.strokeStyle = GOLD_HIGHLIGHT; ctx.lineWidth = 3;
    ctx.strokeRect(cx+2, cy+2, CELL-4, CELL-4);
    ctx.strokeStyle = '#e8c860'; ctx.lineWidth = 1;
    ctx.strokeRect(cx+6, cy+6, CELL-12, CELL-12);
  }

  // ── 大限命宮（本命＋大限模式）：深綠雙線高亮邊框 ──
  if (isDecadeMingOnly) {
    ctx.strokeStyle = DECADE_HIGHLIGHT; ctx.lineWidth = 3;
    ctx.strokeRect(cx+2, cy+2, CELL-4, CELL-4);
    ctx.strokeStyle = '#5a8a6a'; ctx.lineWidth = 1;
    ctx.strokeRect(cx+6, cy+6, CELL-12, CELL-12);
  }

  // ── Bottom-right (left of stem/branch): 身宮 / 來因宮 直書紅框 ──
  const drawVertRedBox = (text, slot) => {
    const VFS = 14;
    const padding = 3;
    const bw = VFS + 2*padding;
    const bh = text.length * (VFS + 1) + 2*padding;
    // slot 0 = inner (closer to stem/branch), slot 1 = outer (further left)
    const rightEdge = cx + CELL - PAD - 22;  // leave 22px for stem/branch column
    const bx = rightEdge - slot * (bw + 4) - bw;
    const by = cy + CELL - 12 - bh;
    ctx.fillStyle = '#fff';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = RED_BOX; ctx.lineWidth = 1.5;
    ctx.strokeRect(bx + 0.75, by + 0.75, bw - 1.5, bh - 1.5);
    ctx.font = `bold ${VFS}px ${FONT}`;
    ctx.fillStyle = RED_BOX;
    ctx.textAlign = 'center';
    let ty = by + padding;
    for (const ch of text) {
      ctx.fillText(ch, bx + bw/2, ty + VFS);
      ty += VFS + 1;
    }
    ctx.textAlign = 'left';
  };
  // 多重標記時：身宮 inner, 來因宮 next, 小限 outer
  let slot = 0;
  if (palace.name === bodyPalace) { drawVertRedBox('身宮', slot); slot++; }
  if (palace.name === origPalace) { drawVertRedBox('來因宮', slot); slot++; }
  if (isMinorLim)                  { drawVertRedBox('小限', slot); slot++; }

  // ── TOP-LEFT: Three-layer names 流X｜大X｜本命名 ──
  let topY = cy + 14;
  if (hasOverlay) {
    const FS = 11;
    ctx.font = `${FS}px ${FONT}`;
    let tx = cx + PAD;
    const ty = topY + FS - 1;

    const segments = [];
    if (flowMing) {
      const fp = palOffset(palace.name, flowMing);
      if (fp) segments.push({ text:'流'+fp.charAt(0), color:'#c47800' });
    }
    if (decadeMing) {
      const dp = palOffset(palace.name, decadeMing);
      if (dp) segments.push({ text:'大'+dp.charAt(0), color:'#555' });
    }
    segments.push({ text: palace.name, color:'#888' });

    for (let i = 0; i < segments.length; i++) {
      if (i > 0) {
        ctx.fillStyle = '#ddd';
        ctx.fillText('｜', tx, ty);
        tx += ctx.measureText('｜').width;
      }
      ctx.font = `${FS}px ${FONT}`;
      ctx.fillStyle = segments[i].color;
      ctx.fillText(segments[i].text, tx, ty);
      tx += ctx.measureText(segments[i].text).width;
    }
    topY = ty + 4;
  }

  // ── Decorative large dim branch glyph (background) ──
  ctx.font = `bold 56px ${FONT}`; ctx.fillStyle = '#f3f1ed';
  ctx.textAlign = 'right';
  ctx.fillText(palace.branch, cx+CELL-6, cy+60);
  ctx.textAlign = 'left';

  // ── STARS (vertical columns, evenly distributed) ──
  const starsTop = Math.max(topY + 4, cy + (hasOverlay ? 36 : 16));
  // Reserve a thin strip above bottom info area for 流年吉凶星 row
  const TRANSIENT_ROW_H = 18;
  const botStarLim = cy + CELL - BOT - 4 - TRANSIENT_ROW_H;
  const palMu = muMap[palace.name] || [];

  // Reserve right side for stem/branch column (~16px)
  const STEM_BR_RESERVE = 20;
  // Reserve left side for empty-palace text block
  const isEmptyP = palace.isEmpty && palace.borrowedFromPalace;
  const LEFT_RESERVE = isEmptyP ? 58 : 0;

  // Empty palace label (top-left)：「空宮 / 借X宮」字級統一
  if (isEmptyP) {
    const EFS = 11;
    const src = palace.borrowedFromPalace;
    const srcFull = src.endsWith('宮') ? src : src + '宮';
    ctx.font = `bold ${EFS}px ${FONT}`;
    ctx.fillStyle = '#aaa';
    ctx.fillText('空宮', cx + PAD, starsTop + EFS);
    ctx.fillStyle = '#bbb';
    ctx.fillText('借' + srcFull, cx + PAD, starsTop + EFS * 2 + 3);
  }

  // Look up brightness for borrowed stars from the source palace
  const borrowSource = isEmptyP
    ? S.chartData.palaces.find(p => p.name === palace.borrowedFromPalace)
    : null;
  const borrowBrightness = {};
  if (borrowSource) {
    for (const ms of (borrowSource.majorStars || [])) {
      borrowBrightness[ms.name] = ms.brightness || '';
    }
  }

  // Collect all stars (priority order): major, aux, kill, small
  const stars = [];
  if (isEmptyP) {
    // Borrowed major stars — 灰色 + 虛線外框（連同四化也轉灰）
    for (const sname of (palace.borrowedStars || [])) {
      stars.push({
        name: sname,
        brightness: borrowBrightness[sname] || '',
        color: '#9a9a9a',
        isMajor: true,
        isBorrowed: true,
      });
    }
  } else {
    for (const s of (palace.majorStars||[])) {
      stars.push({
        name: s.name,
        brightness: s.brightness || '',
        color: CLR_MAJOR,
        isMajor: true,
      });
    }
  }
  for (const s of (palace.minorStars||[]).filter(s => AUX_STARS.has(s.name))) {
    stars.push({ name: s.name, brightness: s.brightness || '', color: CLR_AUX, isMajor: false });
  }
  for (const s of (palace.minorStars||[]).filter(s => KILL_STARS.has(s.name))) {
    stars.push({ name: s.name, brightness: s.brightness || '', color: CLR_KILL, isMajor: false });
  }
  const otherMin = (palace.minorStars||[]).filter(
    s => !AUX_STARS.has(s.name) && !KILL_STARS.has(s.name)
  );
  for (const s of otherMin) {
    stars.push({ name: s.name, brightness: s.brightness || '', color: CLR_SMALL, isMajor: false });
  }
  for (const s of (palace.smallStars||[])) {
    stars.push({ name: s.name, brightness: '', color: CLR_SMALL, isMajor: false });
  }

  // Calculate dynamic column width and font size based on star count
  const N = stars.length;
  const usableW = CELL - 2*PAD - LEFT_RESERVE - STEM_BR_RESERVE;

  // 字級規則：主/輔/凶 = FS_MAIN（即「天相」字級）；小星(淺藍) = FS_SMALL（即「龍池」字級）
  const FS_MAIN  = 22;
  const FS_SMALL = 16;
  for (const s of stars) s.fs = (s.color === CLR_SMALL) ? FS_SMALL : FS_MAIN;

  // 每顆星的欄寬（緊湊配置，避免主星溢出宮位）
  const colWFor = fs => fs + 4;
  let colWs = stars.map(s => colWFor(s.fs));
  let totalW = colWs.reduce((a, b) => a + b, 0);

  // 若總寬超過可用寬度則等比縮字（最小 10px）
  if (totalW > usableW && totalW > 0) {
    const ratio = usableW / totalW;
    for (let i = 0; i < stars.length; i++) {
      stars[i].fs = Math.max(10, Math.floor(stars[i].fs * ratio));
      colWs[i] = colWFor(stars[i].fs);
    }
    totalW = colWs.reduce((a, b) => a + b, 0);
  }

  const startX = cx + PAD + LEFT_RESERVE + Math.max(0, (usableW - totalW) / 2);
  let cursorX = startX;
  for (let i = 0; i < N; i++) {
    const star = stars[i];
    const cw = colWs[i];
    const centerX = cursorX + cw / 2;
    const mu = palMu.filter(m => m.star === star.name);
    drawStarColumn(ctx, centerX, starsTop, botStarLim, star.name, star.brightness, mu, star.color, star.isMajor, star.fs, star.isBorrowed);
    cursorX += cw;
  }

  // ── 流年吉凶星（橫向一排，字體 = 主星 50%）──
  drawTransientRow(
    ctx, cx, cy,
    palace,
    opts.decadeMu || [],
    (opts.flowTransByBranch || {})[palace.branch] || [],
    botStarLim + 2,
    TRANSIENT_ROW_H,
  );

  // ── BOTTOM 三層資訊 ──
  // Layer 1（最上）: 該宮位對應的流年「2026年／丙午年」 深灰
  // Layer 2: 該宮位的大限年份範圍「2020~2029年」 淺灰
  // Layer 3（最下）: 宮位名「官祿宮」 加粗黑大字
  // 字置中，但要避開右下角的天干地支區
  const centerBx = cx + CELL/2 - 14;
  ctx.textAlign = 'center';

  // 依宮位地支計算對應的流年
  if (opts.flowYearVal && opts.flowYearBranch) {
    const py = getPalaceFlowYear(palace.branch, opts.flowYearVal, opts.flowYearBranch);
    const palaceGZ = py.stem + py.branch;
    ctx.font = `11px ${FONT}`; ctx.fillStyle = '#555';
    ctx.fillText(`${py.year}年／${palaceGZ}年`, centerBx, cy + CELL - 56);
  }

  if (palace.decadeRange && birthYear) {
    const startAge = palace.decadeRange[0];
    // 第10/11/12 大限（94歲+）顯示「胎兒命」取代太遙遠的西元年
    if (startAge >= 94) {
      ctx.font = `11px ${FONT}`; ctx.fillStyle = '#bbb';
      ctx.fillText('胎兒命', centerBx, cy + CELL - 38);
    } else {
      const sy0 = birthYear + startAge - 1;
      const ey0 = birthYear + palace.decadeRange[1] - 1;
      ctx.font = `11px ${FONT}`; ctx.fillStyle = '#aaa';
      ctx.fillText(`${sy0} ~ ${ey0} 年`, centerBx, cy + CELL - 38);
    }
  }

  // 宮位名（加大加粗，加「宮」後綴）
  ctx.font = `bold 18px ${FONT}`; ctx.fillStyle = '#1a1a1a';
  const palaceLabel = palace.name + (palace.name.endsWith('宮') ? '' : '宮');
  ctx.fillText(palaceLabel, centerBx, cy + CELL - 14);
  ctx.textAlign = 'left';

  // ── BOTTOM-RIGHT: Stem ↑ Branch ↓ ──
  ctx.font = `11px ${FONT}`; ctx.fillStyle = '#666';
  ctx.textAlign = 'right';
  ctx.fillText(palace.stem,   cx+CELL-PAD, cy+CELL-26);
  ctx.fillText(palace.branch, cx+CELL-PAD, cy+CELL-12);
  ctx.textAlign = 'left';
}

// ════════════════════════════════════════════════════════
// CENTER 2×2 (minimal)
// ════════════════════════════════════════════════════════

function drawCenterTo(ctx, fd) {
  const d = S.chartData;
  const cx = CELL, cy = CELL, cw = 2*CELL, ch = 2*CELL;
  const mx = cx + cw/2;

  // Background
  ctx.fillStyle = '#f9f8f4';
  ctx.fillRect(cx, cy, cw, ch);

  ctx.textAlign = 'center';

  if (!d) { ctx.textAlign='left'; return; }

  // Compute extras
  const fy = fd?.flowYear;
  const ml = fd?.currentMajorLimit;
  const yearBranch = d.fourPillars?.raw?.yearly?.[1] || '';
  const zodiac = ZODIACS[yearBranch] || '';
  const pillars = d.fourPillars?.raw || {};
  const pillarLabels = ['年','月','日','時'];
  const pillarKeys = ['yearly','monthly','daily','hourly'];

  const tst    = d.meta?.trueSolarTime;
  const ckt    = d.meta?.clockTime;
  const offset = d.meta?.trueSolarTimeOffsetMinutes;
  const hasTST = !!(tst && ckt && tst !== ckt);

  // ── 統一行距常數 ──
  const LINE_H   = 28;  // 所有內容行：baseline 到下一行 baseline 的距離
  const SEP_SLOT = 20;  // 所有分隔線：佔用同等高度，線畫在正中央（iy + 10）

  // ── 動態計算內容總高度，垂直置中（不含底部 brand 行） ──
  const heights = [];
  if (S.name)        heights.push(LINE_H);   // 姓名
  heights.push(LINE_H);                       // 生日
  if (hasTST)        heights.push(LINE_H);   // 真太陽時
  heights.push(LINE_H);                       // 農曆
  heights.push(SEP_SLOT);                     // sep1
  heights.push(LINE_H);                       // 八字 label
  heights.push(LINE_H);                       // 八字天干
  heights.push(LINE_H);                       // 八字地支
  heights.push(SEP_SLOT);                     // sep2
  heights.push(LINE_H);                       // 命主行
  if (d.baziQiyun)   heights.push(LINE_H);   // 起運行
  heights.push(SEP_SLOT);                     // sep3
  if (fy) {
    heights.push(LINE_H);                     // 流年1 title
    heights.push(LINE_H);                     // 流年1 detail
    heights.push(LINE_H);                     // 流年2 title
    heights.push(LINE_H);                     // 流年2 detail
  }

  const totalContent = heights.reduce((a, b) => a + b, 0);
  const brandH = 50;
  const availableH = ch - brandH;
  const topMargin = Math.max(20, (availableH - totalContent) / 2);
  let iy = cy + topMargin;

  // 姓名
  if (S.name) {
    ctx.font = `bold 24px ${FONT}`; ctx.fillStyle = '#1a1a1a';
    ctx.fillText(S.name, mx, iy); iy += LINE_H;
  }

  // 西元生日 + 時間 + 時辰 + 陰陽
  ctx.font = `bold 20px ${FONT}`; ctx.fillStyle = '#1a1a1a';
  ctx.fillText(`${S.birthDate}　${S.birthTime}　${d.shichen||''}　${d.yinYang||''}`, mx, iy);
  iy += LINE_H;

  // 真太陽時
  if (hasTST) {
    ctx.font = `12px ${FONT}`; ctx.fillStyle = '#9a6a3a';
    ctx.fillText(`真太陽時 ${tst}（${offset >= 0 ? '+' : ''}${offset}分）`, mx, iy);
    iy += LINE_H;
  }

  // 農曆 + 生肖 + 五行局
  ctx.font = `bold 20px ${FONT}`; ctx.fillStyle = '#1a1a1a';
  ctx.fillText(`${d.lunarDate}　${zodiac ? '屬'+zodiac+'　' : ''}${d.fiveElementsClass||''}`, mx, iy);
  iy += LINE_H;

  // ── 分隔線 1 ──
  ctx.strokeStyle = '#d4d0c4'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx+30, iy + SEP_SLOT/2); ctx.lineTo(cx+cw-30, iy + SEP_SLOT/2); ctx.stroke();
  iy += SEP_SLOT;

  // ── 八字四柱（直書） ──
  const colSpacing = 38;
  const totalW     = colSpacing * 4;
  const pStartX    = mx - totalW/2 + colSpacing/2;

  // Label row（年/月/日/時柱）
  ctx.font = `11px ${FONT}`; ctx.fillStyle = '#888';
  for (let i = 0; i < 4; i++) {
    ctx.fillText(pillarLabels[i] + '柱', pStartX + i * colSpacing, iy);
  }
  iy += LINE_H;

  // 天干
  ctx.font = `bold 17px ${FONT}`; ctx.fillStyle = '#1a1a1a';
  for (let i = 0; i < 4; i++) {
    const stem = pillars[pillarKeys[i]]?.[0] || '－';
    ctx.fillText(stem, pStartX + i * colSpacing, iy);
  }
  iy += LINE_H;

  // 地支
  ctx.font = `bold 17px ${FONT}`; ctx.fillStyle = '#1a1a1a';
  for (let i = 0; i < 4; i++) {
    const branch = pillars[pillarKeys[i]]?.[1] || '－';
    ctx.fillText(branch, pStartX + i * colSpacing, iy);
  }
  iy += LINE_H;

  // ── 分隔線 2 ──
  ctx.strokeStyle = '#d4d0c4'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx+30, iy + SEP_SLOT/2); ctx.lineTo(cx+cw-30, iy + SEP_SLOT/2); ctx.stroke();
  iy += SEP_SLOT;

  // 命主 身主 身宮 來因
  ctx.font = `bold 14px ${FONT}`; ctx.fillStyle = '#333';
  ctx.fillText(
    `命主：${d.lifeStars?.mingZhu||'—'}　身主：${d.lifeStars?.shenZhu||'—'}　身宮：${d.bodyPalace?.name||'—'}　來因：${d.originalPalace?.name||'—'}`,
    mx, iy
  );
  iy += LINE_H;

  // 八字起運
  const qy = d.baziQiyun;
  if (qy) {
    ctx.font = `bold 13px ${FONT}`; ctx.fillStyle = '#555';
    ctx.fillText(`降世後 ${qy.years} 歲 ${qy.months} 月 ${qy.days} 天　八字起運`, mx, iy);
    iy += LINE_H;
  }

  // ── 分隔線 3 ──
  ctx.strokeStyle = '#d4d0c4'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx+30, iy + SEP_SLOT/2); ctx.lineTo(cx+cw-30, iy + SEP_SLOT/2); ctx.stroke();
  iy += SEP_SLOT;

  // ── 流年疊盤（當前流年 + 次年） ──
  if (fy) {
    const printOverlay = (year, gz, branchOfPalace) => {
      const flowPal = d.palaces.find(p => p.branch === branchOfPalace);
      if (!flowPal) return;
      const flowMingName = flowPal.name;
      const dpName = ml ? palOffset(flowMingName, ml.palace) : null;
      const dpStr  = dpName ? '大' + dpName.charAt(0) : '大命';

      ctx.font = `bold 17px ${FONT}`; ctx.fillStyle = '#1a1a1a';
      ctx.fillText(`${gz}年（${year}）流年疊盤`, mx, iy);
      iy += LINE_H;

      ctx.font = `15px ${FONT}`; ctx.fillStyle = '#444';
      ctx.fillText(`年命　${dpStr}　本命${flowMingName}宮`, mx, iy);
      iy += LINE_H;
    };

    printOverlay(fy.year, fy.ganZhi, fy.branch);
    const ny  = fy.year + 1;
    const nb  = getYearBranch(ny);
    const ngz = getYearStem(ny) + nb;
    printOverlay(ny, ngz, nb);
  }

  // ── 跨時辰警示（brand 上方） ──
  if (d.meta?.trueSolarTimeCrossedHour) {
    ctx.font = `11px ${FONT}`; ctx.fillStyle = '#e08040';
    ctx.fillText('⚠ 真太陽時校正後時辰已變更，請確認定盤', mx, cy + ch - 44);
  }

  // ── Bottom brand ──
  ctx.font = `bold 14px ${FONT}`; ctx.fillStyle = '#0C6170';
  ctx.fillText("Blue's 紫微斗數命理顧問排盤系統 V3.0", mx, cy + ch - 28);

  ctx.font = `bold 12px ${FONT}`; ctx.fillStyle = '#0C6170';
  ctx.fillText('Crystibee ®', mx, cy + ch - 12);

  ctx.textAlign = 'left';
}

// ════════════════════════════════════════════════════════
// CRYSTIBEE WATERMARK LOGO (Triquetra + gothic text)
// ════════════════════════════════════════════════════════

// Watermark image (loaded from /watermark.png if available)
let WATERMARK_IMG = null;
(function loadWatermark() {
  const img = new Image();
  img.onload = () => {
    WATERMARK_IMG = img;
    // Re-render all charts now that watermark is loaded
    if (typeof renderAllCharts === 'function') renderAllCharts();
    else if (S.chartData) renderChart();
  };
  img.onerror = () => { /* keep fallback SVG drawing */ };
  img.src = '/watermark.png';
})();

function drawCrystibeeLogo(ctx, cx, cy, size, color) {
  // Prefer loaded PNG; fall back to canvas-drawn triquetra
  if (WATERMARK_IMG && WATERMARK_IMG.complete && WATERMARK_IMG.naturalWidth > 0) {
    ctx.save();
    ctx.globalAlpha = 0.126;  // 0.18 × 0.7 = 顏色淡 30%
    const iw = WATERMARK_IMG.naturalWidth;
    const ih = WATERMARK_IMG.naturalHeight;
    const ratio = ih / iw;
    const drawW = size;
    const drawH = drawW * ratio;
    ctx.drawImage(WATERMARK_IMG, cx - drawW/2, cy - drawH/2, drawW, drawH);
    ctx.restore();
    return;
  }

  // Fallback: canvas-drawn triquetra + gothic "Crystibee"
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const R = size * 0.32;
  const offset = size * 0.20;
  const centers = [
    { x: cx,              y: cy - offset*1.4 },
    { x: cx - offset*1.2, y: cy + offset*0.5 },
    { x: cx + offset*1.2, y: cy + offset*0.5 },
  ];
  ctx.lineWidth = size * 0.035;
  for (const c of centers) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, R, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.lineWidth = size * 0.015;
  for (const c of centers) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, R - size * 0.07, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.font = `italic bold ${size * 0.18}px "UnifrakturMaguntia","Old English Text MT","Apple Chancery","Times New Roman",serif`;
  ctx.textAlign = 'center';
  ctx.fillText('Crystibee', cx, cy + size * 0.55);
  ctx.restore();
}

// ════════════════════════════════════════════════════════
// MAIN RENDER
// ════════════════════════════════════════════════════════

// 依檢視模式過濾 flowData 疊盤層：
// natal  → 不傳任何疊盤資料（純本命）
// decade → 保留大限層（currentMajorLimit），剝除流年層
// flow   → 完整三盤
function effectiveFlowData(fd) {
  if (!fd) return null;
  if (S.viewMode === 'natal') return null;
  if (S.viewMode === 'decade') {
    return { currentMajorLimit: fd.currentMajorLimit || null };
  }
  return fd;
}

// Render chart onto a SPECIFIC canvas with SPECIFIC flowData.
function renderChartTo(canvas, fdRaw) {
  const ctx = setupCanvas(canvas);
  const d = S.chartData;
  if (!d) return;

  const fd = effectiveFlowData(fdRaw);

  const muMap      = buildMuMap(d.yearMutagens, fd?.currentMajorLimit?.mutagens, fd?.flowYearMutagens);
  const flowTransByBranch = fd?.flowYearTransientsByBranch || {};
  const decadeMu   = fd?.currentMajorLimit?.mutagens || [];
  const decadeMing = fd?.currentMajorLimit?.palace       || null;
  const flowMing   = fd?.flowYearLifePalace?.name        || null;
  const minorLimPalace = fd?.minorLimitPalace?.name      || null;
  const origPalace = d.originalPalace?.name              || null;
  const bodyPalace = d.bodyPalace?.name                  || null;
  const birthYear  = parseInt(S.birthDate.split('-')[0]);

  // 宮位底部流年資訊列只在「流年」檢視模式顯示
  const showFlowLayer  = S.viewMode === 'flow';
  const flowYearVal    = showFlowLayer ? (fd?.flowYear?.year || S.currentYear) : null;
  const flowYearBranch = showFlowLayer ? (fd?.flowYear?.branch || getYearBranch(flowYearVal)) : null;
  const flowYearGZ     = showFlowLayer ? (fd?.flowYear?.ganZhi || '') : '';

  drawGrid(ctx);
  for (const palace of d.palaces) {
    const pos = BRANCH_POS[palace.branch]; if (!pos) continue;
    drawPalace(ctx, palace, pos[0], pos[1], {
      muMap, decadeMing, flowMing, minorLimPalace,
      origPalace, bodyPalace, birthYear,
      flowYearVal, flowYearBranch, flowYearGZ,
      flowTransByBranch, decadeMu,
    });
  }
  drawCenterTo(ctx, fd);

  // 三方四正動態高亮（點擊宮位後）
  if (S.selectedBranch) drawTrineLines(ctx, S.selectedBranch, S.dashOffset);

  // 綁定一次點擊事件
  bindPalaceClick(canvas);
}

// 地支位移：B + n (mod 12)
function shiftBranch(b, n) {
  const i = EARTHLY_BRANCHES.indexOf(b);
  if (i < 0) return null;
  return EARTHLY_BRANCHES[(i + n + 12) % 12];
}

// 取得宮位中心點 (BASE 座標)
function branchCenter(b) {
  const pos = BRANCH_POS[b]; if (!pos) return null;
  return { x: pos[1] * CELL + CELL/2, y: pos[0] * CELL + CELL/2 };
}

// 三方四正：對宮 (+6) + 三合 (+4, +8)
function drawTrineLines(ctx, branch, dashOffset) {
  const src = branchCenter(branch); if (!src) return;
  const targets = [
    shiftBranch(branch, 6),  // 對宮
    shiftBranch(branch, 4),  // 三合
    shiftBranch(branch, 8),  // 三合
  ].map(branchCenter).filter(Boolean);

  ctx.save();
  // 點亮選中宮位四角
  const sp = BRANCH_POS[branch];
  if (sp) {
    ctx.strokeStyle = GOLD_HIGHLIGHT;
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.strokeRect(sp[1]*CELL+3, sp[0]*CELL+3, CELL-6, CELL-6);
  }
  // 三條虛線
  ctx.strokeStyle = GOLD_HIGHLIGHT;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([10, 6]);
  ctx.lineDashOffset = -dashOffset;  // 負值 → 虛線往外（src→dst）移動
  for (const t of targets) {
    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();
  }
  // 端點圓點
  ctx.setLineDash([]);
  ctx.fillStyle = GOLD_HIGHLIGHT;
  ctx.beginPath(); ctx.arc(src.x, src.y, 5, 0, Math.PI*2); ctx.fill();
  for (const t of targets) {
    ctx.beginPath(); ctx.arc(t.x, t.y, 4, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function startTrineAnim() {
  stopTrineAnim();
  const tick = () => {
    if (!S.selectedBranch) return;
    S.dashOffset = (S.dashOffset + 0.6) % 32;
    renderAllCharts();
    S.trineRaf = requestAnimationFrame(tick);
  };
  S.trineRaf = requestAnimationFrame(tick);
}
function stopTrineAnim() {
  if (S.trineRaf) cancelAnimationFrame(S.trineRaf);
  S.trineRaf = null;
}

function bindPalaceClick(canvas) {
  if (canvas.dataset.trineBound) return;
  canvas.dataset.trineBound = '1';
  canvas.style.cursor = 'pointer';
  canvas.addEventListener('click', (e) => {
    // 剛完成滑動手勢 → 忽略本次 click（避免誤觸宮位選取）
    if (Date.now() - S.lastSwipeTs < 500) return;
    const rect = canvas.getBoundingClientRect();
    const scale = BASE / rect.width;
    const x = (e.clientX - rect.left) * scale;
    const y = (e.clientY - rect.top)  * scale;
    const col = Math.floor(x / CELL);
    const row = Math.floor(y / CELL);
    let branch = null;
    for (const b of Object.keys(BRANCH_POS)) {
      const [r, c] = BRANCH_POS[b];
      if (r === row && c === col) { branch = b; break; }
    }
    // 點中央資訊區或同一宮位 → 清除
    if (!branch || S.selectedBranch === branch) {
      S.selectedBranch = null;
      stopTrineAnim();
      renderAllCharts();
      return;
    }
    S.selectedBranch = branch;
    S.dashOffset = 0;
    startTrineAnim();
  });
}

// Backward-compat: render the primary canvas (used by changeYear which still
// targets the legacy single canvas id if it exists).
function renderChart() {
  // Rerender all blocks (covers multi-year mode + handles WATERMARK_IMG reload)
  if (S.yearBlocks && S.yearBlocks.length) renderAllCharts();
}
