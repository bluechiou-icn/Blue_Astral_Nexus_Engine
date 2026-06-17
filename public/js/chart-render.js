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

// 小星專用：僅直書星名（淺藍小星無亮度／四化），lineH 可控字間空檔。
// 用於「>3 顆折兩行」的小星區塊。
function drawStarColumnSmall(ctx, centerX, top, name, color, fs, lineH) {
  ctx.textAlign = 'center';
  ctx.font = `${fs}px ${FONT}`;
  ctx.fillStyle = color;
  let y = top;
  for (const ch of name) {
    ctx.fillText(ch, centerX, y + fs);
    y += lineH;
  }
  ctx.textAlign = 'left';
}

// ── EN 模式：星曜橫排（拉丁字串不適合直書，改一星一列）──
// 主星：粗體意譯 + 小字 pinyin；其他星：pinyin。亮度、四化徽章接在列尾。
// 超寬等比縮字、超高等比縮列，沿用 zh 模式的 shrink-to-fit 原則。
function drawStarsEn(ctx, stars, palMu, xL, xR, top, bottom) {
  if (!stars.length) return;
  const maxW = xR - xL;
  let fs = 13;
  // 垂直 fit：列高 = fs + 5
  const availH = bottom - top;
  if (stars.length * (fs + 5) > availH) {
    fs = Math.max(7, Math.floor(availH / stars.length) - 5);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let y = top;
  for (const star of stars) {
    if (y + fs > bottom) break;
    const mu = palMu.filter(m => m.star === star.name);
    const meaning = star.isMajor ? (STAR_EN[star.name]?.m || '') : '';
    const pinyin  = STAR_EN[star.name]?.p || star.name;
    const small = Math.max(6, fs - 3);

    // 段落組裝：[主名(粗)] [pinyin(小)] [亮度(小)] [四化chips]
    const segs = [];
    if (star.isMajor && meaning) {
      segs.push({ txt: meaning, fs, bold: true, color: star.color });
      segs.push({ txt: ' ' + pinyin, fs: small, bold: false, color: star.isBorrowed ? star.color : '#8a8a8a' });
    } else {
      segs.push({ txt: pinyin, fs, bold: star.isMajor, color: star.color });
    }
    if (star.brightness) {
      segs.push({ txt: ' ·' + tBright(star.brightness), fs: small, bold: false,
                  color: star.isBorrowed ? star.color : (BRIGHT_CLR[star.brightness] || '#666') });
    }

    // 量測：文字段 + chips（chip 寬 = 字寬 + padding 4，間距 3）
    const measure = (scale = 1) => {
      let w = 0;
      for (const sg of segs) {
        ctx.font = `${sg.bold ? 'bold ' : ''}${Math.max(6, Math.round(sg.fs * scale))}px ${FONT_EN}`;
        w += ctx.measureText(sg.txt).width;
      }
      for (const m of mu) {
        const key = MU_KEY[m.type]; if (!key) continue;
        const cfs = Math.max(6, Math.round((fs - 3) * scale));
        ctx.font = `bold ${cfs}px ${FONT_EN}`;
        w += ctx.measureText(tMuBadge(key)).width + 4 + 3;
      }
      return w;
    };
    let scale = 1;
    const w0 = measure(1);
    if (w0 > maxW) scale = Math.max(0.5, maxW / w0);

    // 借星：整列灰化 + 虛線外框
    if (star.isBorrowed) {
      ctx.save();
      ctx.strokeStyle = '#999';
      ctx.setLineDash([3, 2]);
      ctx.lineWidth = 1;
      ctx.strokeRect(xL - 2, y - 1, Math.min(maxW, measure(scale)) + 4, fs + 4);
      ctx.restore();
    }

    let x = xL;
    for (const sg of segs) {
      const sfs = Math.max(6, Math.round(sg.fs * scale));
      ctx.font = `${sg.bold ? 'bold ' : ''}${sfs}px ${FONT_EN}`;
      ctx.fillStyle = sg.color;
      ctx.fillText(sg.txt, x, y + (fs - sfs));
      x += ctx.measureText(sg.txt).width;
    }
    // 四化 chips（顏色依來源：生年紅/大限綠/流年藍；借星 → 灰）
    for (const m of mu) {
      const key = MU_KEY[m.type]; if (!key) continue;
      const palette = MU_BY_SRC[m.src]; if (!palette) continue;
      const cfs = Math.max(6, Math.round((fs - 3) * scale));
      ctx.font = `bold ${cfs}px ${FONT_EN}`;
      const label = tMuBadge(key);
      const cw = ctx.measureText(label).width + 4;
      const chH = cfs + 3;
      x += 3;
      if (star.isBorrowed) {
        ctx.fillStyle = '#e8e8e8';
        ctx.fillRect(x, y, cw, chH);
        ctx.save();
        ctx.strokeStyle = '#9a9a9a'; ctx.setLineDash([2, 2]); ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, chH - 1);
        ctx.restore();
        ctx.fillStyle = '#9a9a9a';
      } else {
        ctx.fillStyle = palette.bg;
        ctx.fillRect(x, y, cw, chH);
        ctx.fillStyle = palette.fg;
      }
      ctx.fillText(label, x + 2, y + 1);
      x += cw;
    }
    y += fs + 5;
  }
  ctx.textBaseline = 'alphabetic';
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
  // 注意：迴圈變數不可命名為 t（會遮蔽 i18n 的 t()）
  for (const ft of flowTrans) {
    labels.push({ text: tFlowTrans(ft), color: FLOW_TRANS_COLOR[ft] || '#444', bg: null });
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
  const { muMap, decadeMing, flowMing, monthMing, minorLimPalace,
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
  // EN 模式：橫排小紅框（拉丁字不直書），由右向左堆疊
  let redBoxRight = cx + CELL - PAD - 22;
  const drawHorizRedBox = (text) => {
    const FSr = 9;
    ctx.font = `bold ${FSr}px ${FONT_EN}`;
    const bw = ctx.measureText(text).width + 8, bh = 14;
    const bx = redBoxRight - bw;
    const by = cy + CELL - 12 - bh;
    ctx.fillStyle = '#fff';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = RED_BOX; ctx.lineWidth = 1.5;
    ctx.strokeRect(bx + 0.75, by + 0.75, bw - 1.5, bh - 1.5);
    ctx.fillStyle = RED_BOX;
    ctx.textAlign = 'center';
    ctx.fillText(text, bx + bw / 2, by + bh - 4);
    ctx.textAlign = 'left';
    redBoxRight = bx - 4;
  };

  // 多重標記時：身宮 inner, 來因宮 next, 小限 outer
  let slot = 0;
  const markBox = (text) => {
    if (isEn()) drawHorizRedBox(text);
    else { drawVertRedBox(text, slot); slot++; }
  };
  if (palace.name === bodyPalace) markBox(t('cv_body_box'));
  if (palace.name === origPalace) markBox(t('cv_origin_box'));
  if (isMinorLim)                 markBox(t('cv_minor_box'));

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
      if (fp) segments.push({ text: isEn() ? 'F·'+tPalaceShort(fp) : '流'+palaceCharZh(fp), color:'#c47800' });
    }
    if (decadeMing) {
      const dp = palOffset(palace.name, decadeMing);
      if (dp) segments.push({ text: isEn() ? 'D·'+tPalaceShort(dp) : '大'+palaceCharZh(dp), color:'#555' });
    }
    segments.push({ text: isEn() ? tPalaceName(palace.name) : palace.name, color:'#888' });

    const sepCh = isEn() ? ' | ' : '｜';
    const segFont = isEn() ? `${FS-1}px ${FONT_EN}` : `${FS}px ${FONT}`;
    for (let i = 0; i < segments.length; i++) {
      if (i > 0) {
        ctx.font = segFont;
        ctx.fillStyle = '#ddd';
        ctx.fillText(sepCh, tx, ty);
        tx += ctx.measureText(sepCh).width;
      }
      ctx.font = segFont;
      ctx.fillStyle = segments[i].color;
      ctx.fillText(segments[i].text, tx, ty);
      tx += ctx.measureText(segments[i].text).width;
    }
    topY = ty + 4;
  }

  // ── Decorative large dim branch glyph (background) ──
  if (isEn()) {
    ctx.font = `bold 30px ${FONT_EN}`; ctx.fillStyle = '#f3f1ed';
    ctx.textAlign = 'right';
    ctx.fillText(tBranch(palace.branch), cx+CELL-6, cy+38);
  } else {
    ctx.font = `bold 56px ${FONT}`; ctx.fillStyle = '#f3f1ed';
    ctx.textAlign = 'right';
    ctx.fillText(palace.branch, cx+CELL-6, cy+60);
  }
  ctx.textAlign = 'left';

  // ── STARS (vertical columns, evenly distributed) ──
  const starsTop = Math.max(topY + 4, cy + (hasOverlay ? 36 : 16));
  // Reserve a thin strip above bottom info area for 流年吉凶星 row
  const TRANSIENT_ROW_H = 18;
  const botStarLim = cy + CELL - BOT - 4 - TRANSIENT_ROW_H;
  const palMu = muMap[palace.name] || [];

  // Reserve right side for stem/branch column (~16px)
  const STEM_BR_RESERVE = 20;
  // 空宮借星改置滿欄（不再佔左欄）；zh 的「空宮／借X宮」標示移到宮位下方（位置讓給星曜）
  const isEmptyP = palace.isEmpty && palace.borrowedFromPalace;
  const LEFT_RESERVE = 0;
  let enStarsTop = starsTop;

  // Empty palace label（EN 版）：「Empty ← Travel」橫排於星列上方一行
  // zh 版移至宮位下方左側繪製（見 BOTTOM 區）
  if (isEmptyP && isEn()) {
    const EFS = 11;
    const src = palace.borrowedFromPalace;
    ctx.font = `bold ${EFS}px ${FONT_EN}`;
    ctx.fillStyle = '#aaa';
    const emptyTxt = t('cv_empty');
    ctx.fillText(emptyTxt, cx + PAD, enStarsTop + EFS);
    ctx.fillStyle = '#bbb';
    ctx.fillText(' ← ' + tPalaceName(src), cx + PAD + ctx.measureText(emptyTxt).width, enStarsTop + EFS);
    enStarsTop += EFS + 6;
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

  if (isEn()) {
    // EN 模式：橫排一星一列
    drawStarsEn(ctx, stars, palMu, cx + PAD, cx + CELL - PAD - STEM_BR_RESERVE, enStarsTop, botStarLim);
  } else {
    // 字級規則（固定，不隨星數縮放）：
    //   主/輔/凶（重要星）= FS_MAIN（官祿宮「太陽」字級）
    //   淺藍小星          = FS_SMALL（田宅宮「天才」字級）
    const FS_MAIN  = 22;
    const FS_SMALL = 16;

    // 重要星（主/輔/凶，含借星）走整欄直書；淺藍小星另成區塊（>3 顆折兩行）
    const importantStars = stars.filter(s => s.color !== CLR_SMALL);
    const smallStars2    = stars.filter(s => s.color === CLR_SMALL);
    for (const s of importantStars) s.fs = FS_MAIN;

    const colWFor = fs => fs + 4;
    const impColW   = colWFor(FS_MAIN);
    const smallColW = colWFor(FS_SMALL);

    // 小星區塊：≤3 一行；>3 兩行（上行 ceil(n/2) 欄，下行其餘）
    const smallN    = smallStars2.length;
    const smallCols = smallN > 3 ? Math.ceil(smallN / 2) : smallN;
    const smallBlockW = smallCols * smallColW;

    let impW   = importantStars.length * impColW;
    let totalW = impW + smallBlockW;

    // 折兩行後仍溢出才等比縮字（保底，正常情況不觸發 → 主星維持太陽字級）
    let scale = 1;
    if (totalW > usableW && totalW > 0) {
      scale = Math.max(0.6, usableW / totalW);
    }
    const impCW   = impColW   * scale;
    const smCW    = smallColW * scale;
    const impFS   = Math.max(12, Math.round(FS_MAIN  * scale));
    const smFS    = Math.max(10, Math.round(FS_SMALL * scale));
    const drawnW  = importantStars.length * impCW + smallCols * smCW;

    let cursorX = cx + PAD + Math.max(0, (usableW - drawnW) / 2);

    // 1) 重要星：整欄直書
    for (const star of importantStars) {
      const centerX = cursorX + impCW / 2;
      const mu = palMu.filter(m => m.star === star.name);
      drawStarColumn(ctx, centerX, starsTop, botStarLim, star.name, star.brightness, mu, star.color, star.isMajor, impFS, star.isBorrowed);
      cursorX += impCW;
    }

    // 2) 淺藍小星：≤3 同一行；>3 折兩行（龍池下方排天傷，天傷右邊年解）
    if (smallN > 0) {
      const smLineH = smFS + 4;             // 兩字間留空檔，不黏一起
      const smColH  = smLineH * 2 + 2;      // 單欄（兩字）高度
      const rowGap  = 8;                    // 兩行之間留空檔
      const row1Top = starsTop;
      const row2Top = starsTop + smColH + rowGap;
      for (let c = 0; c < smallCols; c++) {
        const centerX = cursorX + smCW / 2;
        // 上行
        const s1 = smallStars2[c];
        if (s1) {
          const mu1 = palMu.filter(m => m.star === s1.name);
          drawStarColumnSmall(ctx, centerX, row1Top, s1.name, s1.color, smFS, smLineH);
        }
        // 下行（折行時才有）
        const s2 = smallStars2[smallCols + c];
        if (s2) {
          drawStarColumnSmall(ctx, centerX, row2Top, s2.name, s2.color, smFS, smLineH);
        }
        cursorX += smCW;
      }
    }
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
    ctx.font = isEn() ? `10px ${FONT_EN}` : `11px ${FONT}`; ctx.fillStyle = '#555';
    ctx.fillText(isEn() ? `${py.year} · ${tGZ(palaceGZ)}` : `${py.year}年／${palaceGZ}年`, centerBx, cy + CELL - 56);
  }

  if (palace.decadeRange && birthYear) {
    const startAge = palace.decadeRange[0];
    // 第10/11/12 大限（94歲+）顯示「胎兒命」取代太遙遠的西元年
    if (startAge >= 94) {
      ctx.font = isEn() ? `10px ${FONT_EN}` : `11px ${FONT}`; ctx.fillStyle = '#bbb';
      ctx.fillText(t('cv_fetal'), centerBx, cy + CELL - 38);
    } else {
      const sy0 = birthYear + startAge - 1;
      const ey0 = birthYear + palace.decadeRange[1] - 1;
      ctx.font = isEn() ? `10px ${FONT_EN}` : `11px ${FONT}`; ctx.fillStyle = '#aaa';
      ctx.fillText(isEn() ? `${sy0}–${ey0}` : `${sy0} ~ ${ey0} 年`, centerBx, cy + CELL - 38);
    }
  }

  // 宮位名（加大加粗，zh 加「宮」後綴；en 用意譯）
  if (isEn()) {
    ctx.font = `bold 15px ${FONT_EN}`; ctx.fillStyle = '#1a1a1a';
    ctx.fillText(tPalaceName(palace.name), centerBx, cy + CELL - 14);
  } else {
    ctx.font = `bold 18px ${FONT}`; ctx.fillStyle = '#1a1a1a';
    const palaceLabel = palace.name + (palace.name.endsWith('宮') ? '' : '宮');
    ctx.fillText(palaceLabel, centerBx, cy + CELL - 14);
  }
  ctx.textAlign = 'left';

  // 空宮「空宮／借X宮」標示（zh）：移至宮位下方左側，把上方位置讓給借入星曜
  if (isEmptyP && !isEn()) {
    const EFS = 11;
    const src = palace.borrowedFromPalace;
    const srcFull = src.endsWith('宮') ? src : src + '宮';
    ctx.font = `bold ${EFS}px ${FONT}`;
    ctx.fillStyle = '#aaa';
    ctx.fillText('空宮', cx + PAD, cy + CELL - 44);
    ctx.fillStyle = '#bbb';
    ctx.fillText('借' + srcFull, cx + PAD, cy + CELL - 30);
  }

  // ── 流月十二宮「月X」標籤（汎天派順排）──
  //   位置：左下角橫向外框；若空宮 → 排在空宮訊息上方，否則直接置左下
  //   色系：米金（accent beige，排除紅色，跟新 UI match）
  if (monthMing) {
    const monthOffsetPal = palOffset(palace.name, monthMing);
    if (monthOffsetPal) {
      const monthLabel = isEn()
        ? 'M·' + tPalaceShort(monthOffsetPal)
        : '月' + palaceCharZh(monthOffsetPal);
      drawMonthLabelBox(ctx, cx, cy, monthLabel, isEmptyP);
    }
  }

  // ── BOTTOM-RIGHT: Stem ↑ Branch ↓ ──
  ctx.font = isEn() ? `9px ${FONT_EN}` : `11px ${FONT}`; ctx.fillStyle = '#666';
  ctx.textAlign = 'right';
  ctx.fillText(tStem(palace.stem),     cx+CELL-PAD, cy+CELL-26);
  ctx.fillText(tBranch(palace.branch), cx+CELL-PAD, cy+CELL-12);
  ctx.textAlign = 'left';
}

// ════════════════════════════════════════════════════════
// 流月「月X」橫向標籤（左下角，米金色外框，非紅）
//   isEmptyAbove=true 時往上排，讓位給「空宮／借X宮」訊息
// ════════════════════════════════════════════════════════

function drawMonthLabelBox(ctx, cx, cy, label, isEmptyAbove) {
  const FS = isEn() ? 10 : 11;
  const padX = 5, padY = 3;
  ctx.font = `bold ${FS}px ${isEn() ? FONT_EN : FONT}`;
  const bw = ctx.measureText(label).width + 2 * padX;
  const bh = FS + 2 * padY;
  const bx = cx + PAD;
  // 預設左下角貼近底部資訊列上方；空宮時往上推 30px，讓位給空宮／借X宮
  const bottomOffsetFromBottom = isEmptyAbove ? 60 : 26;
  const by = cy + CELL - bottomOffsetFromBottom - bh;

  // 米金色系：填底淺米 + 描邊深米 + 文字深褐（非紅，跟新 UI 米色 accent match）
  ctx.fillStyle = '#fdf6e8';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#a89878';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bx + 0.75, by + 0.75, bw - 1.5, bh - 1.5);
  ctx.fillStyle = '#5a4530';
  ctx.textAlign = 'left';
  ctx.fillText(label, bx + padX, by + padY + FS - 1);
}

// ════════════════════════════════════════════════════════
// CENTER 2×2 (minimal)
// ════════════════════════════════════════════════════════

function drawCenterTo(ctx, fd) {
  const d = S.chartData;
  const cx = CELL, cy = CELL, cw = 2*CELL, ch = 2*CELL;
  const mx = cx + cw/2;

  // Background — 升級為深淺 beige，跟新 UI 米色 accent match（高級感）
  ctx.fillStyle = '#ede2c8';
  ctx.fillRect(cx, cy, cw, ch);

  // Watermark removed per design update

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

  // ── Center panel: space-evenly layout ──
  // items[] mixes text-row objects { size, draw(baseline) } and null (= separator).
  // Text rows drive the distribution; nulls mark separator positions.
  // After computing positions, seps are drawn at the geometric midpoint between
  // the bottom of the preceding text row and the top of the following text row.
  const ASCENT = 0.82;  // baseline ≈ top + ASCENT × size  (CJK em-box approximation)
  const brandH = 50;
  const TOP_PAD = 12;  // 姓名不貼上 edge（Blue 視覺平衡指示 2026-06-17）
  const availH = ch - brandH - TOP_PAD;  // usable above brand area

  const tst    = d.meta?.trueSolarTime;
  const ckt    = d.meta?.clockTime;
  const offset = d.meta?.trueSolarTimeOffsetMinutes;
  const hasTST = !!(tst && ckt && tst !== ckt);
  const qy     = d.baziQiyun;

  // BaZi column geometry (referenced in draw closures below)
  const colSpacing     = 38;
  const pStartX        = mx - (colSpacing * 4) / 2 + colSpacing / 2;
  const enPillarLabels = ['Yr', 'Mo', 'Day', 'Hr'];

  // Font sizes — adapt to language so spacing matches rendered text.
  // ov_title / ov_det 對齊 life（命主/身主）字級，依 Blue 2026-06-17 規範。
  const FS = {
    name:     isEn() ? 22 : 24,
    birth:    isEn() ? 16 : 20,
    tst:      12,
    lunar:    isEn() ? 15 : 20,
    label:    isEn() ? 10 : 11,
    pillar:   isEn() ? 13 : 17,
    life:     isEn() ? 11 : 14,
    luck:     isEn() ? 11 : 13,
    ov_title: isEn() ? 11 : 14,
    ov_det:   isEn() ? 11 : 14,
  };

  const items = [];  // { size, draw(y) } | null

  if (S.name) items.push({ size: FS.name, draw: y => {
    ctx.font = `bold ${FS.name}px ${isEn() ? FONT_EN : FONT}`; ctx.fillStyle = '#1a1a1a';
    ctx.fillText(S.name, mx, y);
  }});

  items.push({ size: FS.birth, draw: y => {
    if (isEn()) {
      ctx.font = `bold ${FS.birth}px ${FONT_EN}`; ctx.fillStyle = '#1a1a1a';
      ctx.fillText(`${S.birthDate}  ${S.birthTime}  ${tShichen(d.shichen||'')}  ${tYinYang(d.yinYang||'')}`, mx, y);
    } else {
      ctx.font = `bold ${FS.birth}px ${FONT}`; ctx.fillStyle = '#1a1a1a';
      ctx.fillText(`${S.birthDate}　${S.birthTime}　${d.shichen||''}　${d.yinYang||''}`, mx, y);
    }
  }});

  if (hasTST) items.push({ size: FS.tst, draw: y => {
    // 警示色 #7a4515 + bold：與米金月X 外框 #a89878/#5a4530 拉開對比，
    // 避免「已定盤=off」命主漏看時辰跨界提醒（Cassian Sprint 3.8 回饋）
    ctx.font = `bold ${FS.tst}px ${isEn() ? FONT_EN : FONT}`; ctx.fillStyle = '#7a4515';
    const offStr = `${offset >= 0 ? '+' : ''}${offset}`;
    ctx.fillText(isEn()
      ? `${t('cv_tst_label')} ${tst} (${offStr} min)`
      : `真太陽時 ${tst}（${offStr}分）`, mx, y);
  }});

  items.push({ size: FS.lunar, draw: y => {
    if (isEn()) {
      ctx.font = `bold ${FS.lunar}px ${FONT_EN}`; ctx.fillStyle = '#1a1a1a';
      ctx.fillText(`${tLunarDate(d.lunarDate)}${zodiac ? ' · '+tZodiac(zodiac) : ''} · ${tWuXingJu(d.fiveElementsClass||'')}`, mx, y);
    } else {
      ctx.font = `bold ${FS.lunar}px ${FONT}`; ctx.fillStyle = '#1a1a1a';
      ctx.fillText(`${d.lunarDate}　${zodiac ? '屬'+zodiac+'　' : ''}${d.fiveElementsClass||''}`, mx, y);
    }
  }});

  items.push(null); // ── sep 1 ──

  items.push({ size: FS.label, draw: y => {
    ctx.font = `${FS.label}px ${isEn() ? FONT_EN : FONT}`; ctx.fillStyle = '#888';
    for (let i = 0; i < 4; i++)
      ctx.fillText(isEn() ? enPillarLabels[i] : pillarLabels[i]+'柱', pStartX + i*colSpacing, y);
  }});

  items.push({ size: FS.pillar, draw: y => {
    ctx.font = `bold ${FS.pillar}px ${isEn() ? FONT_EN : FONT}`; ctx.fillStyle = '#1a1a1a';
    for (let i = 0; i < 4; i++) {
      const stem = pillars[pillarKeys[i]]?.[0] || (isEn() ? '—' : '－');
      ctx.fillText(tStem(stem), pStartX + i*colSpacing, y);
    }
  }});

  items.push({ size: FS.pillar, draw: y => {
    ctx.font = `bold ${FS.pillar}px ${isEn() ? FONT_EN : FONT}`; ctx.fillStyle = '#1a1a1a';
    for (let i = 0; i < 4; i++) {
      const branch = pillars[pillarKeys[i]]?.[1] || (isEn() ? '—' : '－');
      ctx.fillText(tBranch(branch), pStartX + i*colSpacing, y);
    }
  }});

  items.push(null); // ── sep 2 ──

  // 命主／身主（上行，bold 主強調）
  items.push({ size: FS.life, draw: y => {
    if (isEn()) {
      ctx.font = `bold ${FS.life}px ${FONT_EN}`; ctx.fillStyle = '#3a2814';
      ctx.fillText(`${t('cv_ming_lord')} ${tStar(d.lifeStars?.mingZhu)||'—'} · ${t('cv_shen_lord')} ${tStar(d.lifeStars?.shenZhu)||'—'}`, mx, y);
    } else {
      ctx.font = `bold ${FS.life}px ${FONT}`; ctx.fillStyle = '#3a2814';
      ctx.fillText(`命主：${d.lifeStars?.mingZhu||'—'}　身主：${d.lifeStars?.shenZhu||'—'}`, mx, y);
    }
  }});
  // 身宮／來因（下行，輕量副資訊）
  items.push({ size: FS.life, draw: y => {
    if (isEn()) {
      ctx.font = `${FS.life}px ${FONT_EN}`; ctx.fillStyle = '#6b5a3e';
      ctx.fillText(`${t('cv_body_label')} ${tPalaceName(d.bodyPalace?.name)||'—'} · ${t('cv_origin_label')} ${tPalaceName(d.originalPalace?.name)||'—'}`, mx, y);
    } else {
      ctx.font = `${FS.life}px ${FONT}`; ctx.fillStyle = '#6b5a3e';
      ctx.fillText(`身宮：${d.bodyPalace?.name||'—'}　來因：${d.originalPalace?.name||'—'}`, mx, y);
    }
  }});

  if (qy) items.push({ size: FS.luck, draw: y => {
    if (isEn()) {
      ctx.font = `bold ${FS.luck}px ${FONT_EN}`; ctx.fillStyle = '#555';
      ctx.fillText(`BaZi luck cycle starts ${qy.years}y ${qy.months}m ${qy.days}d after birth`, mx, y);
    } else {
      ctx.font = `bold ${FS.luck}px ${FONT}`; ctx.fillStyle = '#555';
      ctx.fillText(`降世後 ${qy.years} 歲 ${qy.months} 月 ${qy.days} 天　八字起運`, mx, y);
    }
  }});

  if (fy) {
    items.push(null); // ── sep 3 (flow mode only) ──

    [
      { year: fy.year, gz: fy.ganZhi, branch: fy.branch },
      { year: fy.year+1, gz: getYearStem(fy.year+1)+getYearBranch(fy.year+1), branch: getYearBranch(fy.year+1) },
    ].forEach(({ year, gz, branch }) => {
      const flowPal = d.palaces.find(p => p.branch === branch);
      if (!flowPal) return;
      const flowMingName = flowPal.name;
      const dpName   = ml ? palOffset(flowMingName, ml.palace) : null;
      const dpStrEn  = dpName ? 'D·'+tPalaceShort(dpName) : 'D·Life';
      const dpStrZh  = dpName ? '大'+palaceCharZh(dpName) : '大命';

      items.push({ size: FS.ov_title, draw: y => {
        if (isEn()) {
          ctx.font = `bold ${FS.ov_title}px ${FONT_EN}`; ctx.fillStyle = '#3a2814';
          ctx.fillText(`${tGZ(gz)} (${year}) Flow Overlay`, mx, y);
        } else {
          ctx.font = `bold ${FS.ov_title}px ${FONT}`; ctx.fillStyle = '#3a2814';
          ctx.fillText(`${gz}年（${year}）流年疊盤`, mx, y);
        }
      }});

      items.push({ size: FS.ov_det, draw: y => {
        if (isEn()) {
          ctx.font = `${FS.ov_det}px ${FONT_EN}`; ctx.fillStyle = '#6b5a3e';
          ctx.fillText(`${t('cv_year_life')} · ${dpStrEn} · Natal ${tPalaceName(flowMingName)}`, mx, y);
        } else {
          ctx.font = `${FS.ov_det}px ${FONT}`; ctx.fillStyle = '#6b5a3e';
          ctx.fillText(`年命　${dpStrZh}　本命${flowMingName}宮`, mx, y);
        }
      }});
    });
  }

  // ── Compute positions ──
  // Text rows: space-evenly in availH (equal gap above first, between all, below last)
  // Seps: drawn at geometric midpoint of the gap they fall within
  const textRows  = items.filter(Boolean);
  const totalTxtH = textRows.reduce((s, r) => s + r.size, 0);
  const gap       = Math.max(4, (availH - totalTxtH) / (textRows.length + 1));

  let tPtr = 0, cumH = 0;
  for (const item of items) {
    if (!item) continue;
    item.top      = cy + TOP_PAD + (tPtr + 1) * gap + cumH;
    item.bottom   = item.top + item.size;
    item.baseline = item.top + item.size * ASCENT;
    cumH += item.size;
    tPtr++;
  }

  // Draw text rows
  for (const item of items) { if (item) item.draw(item.baseline); }

  // Draw separators at midpoint between adjacent text-row boundaries
  ctx.strokeStyle = '#d4d0c4'; ctx.lineWidth = 1;
  for (let i = 0; i < items.length; i++) {
    if (items[i] !== null) continue;
    let prevB = cy, nextT = cy + availH;
    for (let j = i - 1; j >= 0; j--) { if (items[j]) { prevB = items[j].bottom; break; } }
    for (let j = i + 1; j < items.length; j++) { if (items[j]) { nextT = items[j].top; break; } }
    const sy = (prevB + nextT) / 2;
    ctx.beginPath(); ctx.moveTo(cx+30, sy); ctx.lineTo(cx+cw-30, sy); ctx.stroke();
  }

  // ── 跨時辰警示（brand 上方） ──
  if (d.meta?.trueSolarTimeCrossedHour) {
    ctx.font = isEn() ? `11px ${FONT_EN}` : `11px ${FONT}`; ctx.fillStyle = '#e08040';
    ctx.fillText(t('cv_tst_warn'), mx, cy + ch - 44);
  }

  // ── Bottom brand：cv_brand 上行 + Crystibee® 下行（左加 LOGO） ──
  ctx.textAlign = 'center';
  ctx.font = isEn() ? `bold 13px ${FONT_EN}` : `bold 14px ${FONT}`;
  ctx.fillStyle = '#5a4530';
  ctx.fillText(t('cv_brand'), mx, cy + ch - 28);

  // Crystibee® 下行：LOGO + 6px gap + 'Crystibee ®'，整組水平置中
  const crystiText = 'Crystibee ®';
  const crystiFS = 12;
  ctx.font = `bold ${crystiFS}px ${FONT}`;
  const crystiW = ctx.measureText(crystiText).width;
  const logoSize = 14;   // 與字體大小相符（略大於 12 補視覺權重）
  const logoGap = 6;
  const totalBrandW = logoSize + logoGap + crystiW;
  const brandStartX = mx - totalBrandW / 2;
  const brandBaselineY = cy + ch - 12;

  if (LOGO_IMG && LOGO_IMG.complete && LOGO_IMG.naturalWidth > 0) {
    ctx.drawImage(LOGO_IMG, brandStartX, brandBaselineY - logoSize + 2, logoSize, logoSize);
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = '#5a4530';
  ctx.fillText(crystiText, brandStartX + logoSize + logoGap, brandBaselineY);

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

// Brand LOGO 圖片 (Crystibee 左側標誌；Blue 2026-06-17 指示)
let LOGO_IMG = null;
(function loadLogo() {
  const img = new Image();
  img.onload = () => {
    LOGO_IMG = img;
    if (typeof renderAllCharts === 'function') renderAllCharts();
    else if (S.chartData) renderChart();
  };
  img.onerror = () => { /* 無 logo 就略過繪製，文字仍照常顯示 */ };
  img.src = '/logo_black.png';
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
  // 流月命宮 palace name（汎天派順排：用此推算每宮位「月X」標籤）
  const monthMing = S.monthMingBranch
    ? (d.palaces.find(p => p.branch === S.monthMingBranch)?.name || null)
    : null;
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
      muMap, decadeMing, flowMing, monthMing, minorLimPalace,
      origPalace, bodyPalace, birthYear,
      flowYearVal, flowYearBranch, flowYearGZ,
      flowTransByBranch, decadeMu,
    });
  }
  drawCenterTo(ctx, fd);

  // 三方四正動態高亮（點擊宮位後）。
  // 顏色：一般宮位 → 銀灰；若點選的正是本流年命宮 → 維持金色（與流年高亮一致）
  if (S.selectedBranch) {
    const fmBranch = flowMing ? (d.palaces.find(p => p.name === flowMing)?.branch || null) : null;
    drawTrineLines(ctx, S.selectedBranch, S.dashOffset, fmBranch);
  }

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
// flowMingBranch：本流年命宮地支。若點選的正是該宮 → 用金色，否則用銀灰。
function drawTrineLines(ctx, branch, dashOffset, flowMingBranch) {
  const src = branchCenter(branch); if (!src) return;
  const targets = [
    shiftBranch(branch, 6),  // 對宮
    shiftBranch(branch, 4),  // 三合
    shiftBranch(branch, 8),  // 三合
  ].map(branchCenter).filter(Boolean);

  const COLOR = (flowMingBranch && branch === flowMingBranch) ? GOLD_HIGHLIGHT : SILVER_HIGHLIGHT;

  ctx.save();
  // 點亮選中宮位四角
  const sp = BRANCH_POS[branch];
  if (sp) {
    ctx.strokeStyle = COLOR;
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.strokeRect(sp[1]*CELL+3, sp[0]*CELL+3, CELL-6, CELL-6);
  }
  // 三條虛線
  ctx.strokeStyle = COLOR;
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
  ctx.fillStyle = COLOR;
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
      if (typeof renderMonthAxis === 'function') renderMonthAxis();
      renderAllCharts();
      return;
    }
    S.selectedBranch = branch;
    S.dashOffset = 0;
    startTrineAnim();
    if (typeof renderMonthAxis === 'function') renderMonthAxis();
  });
}

// Backward-compat: render the primary canvas (used by changeYear which still
// targets the legacy single canvas id if it exists).
function renderChart() {
  // Rerender all blocks (covers multi-year mode + handles WATERMARK_IMG reload)
  if (S.yearBlocks && S.yearBlocks.length) renderAllCharts();
}

// ════════════════════════════════════════════════════════
// Sprint 2 驗收工具：掃描 Canvas 渲染文字中殘留的 CJK 字元。
// DevTools 切到 EN 後執行 __scanCanvasCJK()，回傳 [] 即通過。
// ════════════════════════════════════════════════════════
function __scanCanvasCJK() {
  const drawn = [];
  const orig = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) {
    drawn.push(String(text));
    return orig.call(this, text, ...rest);
  };
  try { renderAllCharts(); }
  finally { CanvasRenderingContext2D.prototype.fillText = orig; }
  const cjk = /[㐀-鿿豈-﫿]/;
  // 命主姓名為使用者輸入，不在翻譯範圍
  return [...new Set(drawn.filter(s => cjk.test(s) && s !== S.name))];
}
