"use strict";

const fs = require("fs");
const path = require("path");
const { generateChart } = require("./chart-api");

// ── 版面常數 ─────────────────────────────────────────────────
const CELL = 300;          // 每格 300px
const W    = CELL * 4;     // 1200
const H    = CELL * 4;     // 1200
const PAD  = 12;
const SCALE = 2.5;         // 輸出 3000×3000 高解析

// 字體尺寸
const SZ = {
  palaceName: 21,
  stemBranch: 13,
  decadal:    12,
  tag:        11,   // 身宮/來因宮 badge
  major:      20,   // 主星名
  majorBri:   11,   // 主星亮度（獨立行）
  minor:      15,   // 輔星名（亮度行內）
  minorBri:   11,   // 輔星亮度（行內小字）
  adj:        13,   // 雜曜（3 個一行）
  ages:       10,   // 小限歲數
  badge:      12,   // 四化 badge
  watermark: 110,   // 地支水印
};

// 行距
const GAP = {
  afterName:   7,
  afterMajor:  5,
  afterMinor:  4,
  afterBri:    2,
  adjRow:      3,
  afterAdj:    4,
};

// 色系
const C = {
  bg:         '#1a1a2e',
  centerBg:   '#0f0f22',
  border:     '#d4af37',
  gold:       '#d4af37',
  goldDim:    '#9a7e2e',
  star:       '#f0e2b0',   // 主星
  minor:      '#cdbf8a',   // 輔星
  adj:        '#8c7d5a',   // 雜曜
  bri:        '#6a9dbd',   // 亮度
  ages:       '#5a7560',   // 小限
  body:       '#f59e0b',   // 身宮
  original:   '#60a5fa',   // 來因宮
  luk:        '#4ade80',   // 化祿
  kuen:       '#fbbf24',   // 化權
  science:    '#93c5fd',   // 化科
  chi:        '#f87171',   // 化忌
  current:    '#ffd700',   // 當前大限
  watermark:  '#d4af37',   // 地支水印
};

// ── 地支 → 格子位置 ──────────────────────────────────────────
const BRANCH_TO_GRID = {
  '巳': [0,0], '午': [0,1], '未': [0,2], '申': [0,3],
  '酉': [1,3], '戌': [2,3], '亥': [3,3],
  '子': [3,2], '丑': [3,1], '寅': [3,0],
  '卯': [2,0], '辰': [1,0],
};

// ── SVG 工具 ─────────────────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function mutagenColor(m) {
  return { '祿': C.luk, '權': C.kuen, '科': C.science, '忌': C.chi }[m] || C.gold;
}

// 四化 badge（有色底＋白字）
function mutBadge(label, bx, baseY, sz) {
  const bw = sz + 6, bh = sz + 4;
  const rx = Math.round(bx), ry = Math.round(baseY - sz - 1);
  return `<rect x="${rx}" y="${ry}" width="${bw}" height="${bh}" rx="2" fill="${mutagenColor(label)}"/>` +
    `<text x="${rx+bw/2}" y="${ry+bh/2}" font-size="${sz-1}" fill="white" ` +
    `text-anchor="middle" dominant-baseline="central">${esc(label)}</text>`;
}

// 外框 badge（身宮 / 來因宮）
function borderBadge(label, bx, baseY, sz, col) {
  const cw = label.length * sz * 0.9 + 6, ch = sz + 4;
  const rx = Math.round(bx), ry = Math.round(baseY - sz - 1);
  return `<rect x="${rx}" y="${ry}" width="${cw}" height="${ch}" rx="2" fill="none" ` +
    `stroke="${col}" stroke-width="1"/>` +
    `<text x="${rx+cw/2}" y="${ry+ch/2}" font-size="${sz-1}" fill="${col}" ` +
    `text-anchor="middle" dominant-baseline="central">${esc(label)}</text>`;
}
function borderBadgeW(label, sz) { return label.length * sz * 0.9 + 6; }

// 計算當前年齡
function calcAge(solarDate) {
  const t = new Date(), b = new Date(solarDate);
  let age = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) age--;
  return age;
}

// ── 宮格渲染 ─────────────────────────────────────────────────
function renderPalace(palace, gx, gy, isCurrent) {
  let s = '';
  const branch = palace.stemBranch[1];

  // 當前大限底色
  if (isCurrent)
    s += `<rect x="${gx}" y="${gy}" width="${CELL}" height="${CELL}" fill="#221c00" opacity="0.55"/>`;

  // 地支水印（大字、低透明度）
  s += `<text x="${gx+CELL*0.73}" y="${gy+CELL*0.88}" font-size="${SZ.watermark}" ` +
    `fill="${C.watermark}" opacity="0.055" text-anchor="middle" ` +
    `font-weight="bold">${esc(branch)}</text>`;

  // 外框
  const strokeCol = isCurrent ? C.current : C.border;
  const strokeW   = isCurrent ? 2.5 : 1.5;
  s += `<rect x="${gx}" y="${gy}" width="${CELL}" height="${CELL}" fill="none" ` +
    `stroke="${strokeCol}" stroke-width="${strokeW}"/>`;

  // ── 頂部：宮名 / badge / 干支 / 大運範圍 ──────────────────
  const nameY = gy + PAD + SZ.palaceName;

  s += `<text x="${gx+PAD}" y="${nameY}" font-size="${SZ.palaceName}" ` +
    `fill="${C.gold}" font-weight="bold">${esc(palace.name)}</text>`;

  // 身宮 / 來因宮 badge
  let tagX = gx + PAD + palace.name.length * SZ.palaceName + 4;
  if (palace.isBodyPalace) {
    s += borderBadge('身宮', tagX, nameY, SZ.tag, C.body);
    tagX += borderBadgeW('身宮', SZ.tag) + 3;
  }
  if (palace.isOriginalPalace) {
    s += borderBadge('來因宮', tagX, nameY, SZ.tag, C.original);
  }

  // 干支（右上）
  s += `<text x="${gx+CELL-PAD}" y="${gy+PAD+SZ.stemBranch}" font-size="${SZ.stemBranch}" ` +
    `fill="${C.goldDim}" text-anchor="end">${esc(palace.stemBranch)}</text>`;

  // 大運年份（干支正下方）
  const decCol = isCurrent ? C.current : C.goldDim;
  const decBold = isCurrent ? ' font-weight="bold"' : '';
  s += `<text x="${gx+CELL-PAD}" y="${gy+PAD+SZ.stemBranch+SZ.decadal+3}" ` +
    `font-size="${SZ.decadal}" fill="${decCol}" text-anchor="end"${decBold}>` +
    `${esc(palace.decadal[0]+'–'+palace.decadal[1])}</text>`;

  // 分隔線
  const divY = nameY + GAP.afterName;
  s += `<line x1="${gx+PAD}" y1="${divY}" x2="${gx+CELL-PAD}" y2="${divY}" ` +
    `stroke="${C.border}" stroke-width="0.5" opacity="0.28"/>`;

  // ── 星曜區 ────────────────────────────────────────────────
  let sy = divY + 2;

  // 主星（亮度獨立行）
  for (const star of palace.majorStars) {
    sy += SZ.major;
    s += `<text x="${gx+PAD}" y="${sy}" font-size="${SZ.major}" fill="${C.star}">${esc(star.name)}</text>`;
    if (star.mutagen) {
      s += mutBadge(star.mutagen, gx+PAD+star.name.length*SZ.major+2, sy, SZ.badge);
    }
    if (star.brightness) {
      sy += GAP.afterBri + SZ.majorBri;
      s += `<text x="${gx+PAD+5}" y="${sy}" font-size="${SZ.majorBri}" fill="${C.bri}">${esc(star.brightness)}</text>`;
    }
    sy += GAP.afterMajor;
  }

  // 輔星（亮度行內緊接）
  for (const star of palace.minorStars) {
    sy += SZ.minor;
    s += `<text x="${gx+PAD}" y="${sy}" font-size="${SZ.minor}" fill="${C.minor}">${esc(star.name)}</text>`;
    if (star.brightness) {
      const bx = gx + PAD + star.name.length * SZ.minor + 1;
      s += `<text x="${bx}" y="${sy}" font-size="${SZ.minorBri}" fill="${C.bri}">${esc(star.brightness)}</text>`;
    }
    sy += GAP.afterMinor;
  }

  // 雜曜（3 個一行）
  const colW = Math.floor((CELL - 2 * PAD) / 3);
  for (let i = 0; i < palace.adjectiveStars.length; i++) {
    if (i % 3 === 0) sy += SZ.adj;
    const adjX = gx + PAD + (i % 3) * colW;
    s += `<text x="${adjX}" y="${sy}" font-size="${SZ.adj}" fill="${C.adj}">` +
      `${esc(palace.adjectiveStars[i].name)}</text>`;
    if (i % 3 === 2 || i === palace.adjectiveStars.length - 1) sy += GAP.adjRow;
  }

  // 小限歲數
  if (palace.ages && palace.ages.length > 0) {
    sy += GAP.afterAdj + SZ.ages;
    const agesStr = '小：' + palace.ages.slice(0, 7).join(' ');
    s += `<text x="${gx+PAD}" y="${sy}" font-size="${SZ.ages}" fill="${C.ages}">${esc(agesStr)}</text>`;
  }

  return s;
}

// ── 中心格 ───────────────────────────────────────────────────
function renderCenter(chart, name) {
  const cx = CELL, cy = CELL, cw = CELL*2, ch = CELL*2;
  const mid = cx + cw/2;

  let s = '';
  s += `<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="${C.centerBg}" ` +
    `stroke="${C.border}" stroke-width="1.5"/>`;
  const ins = 9;
  s += `<rect x="${cx+ins}" y="${cy+ins}" width="${cw-ins*2}" height="${ch-ins*2}" ` +
    `fill="none" stroke="${C.border}" stroke-width="0.4" opacity="0.22"/>`;

  let ty = cy + 28;

  function row(text, fs, col, bold) {
    const b = bold ? ' font-weight="bold"' : '';
    s += `<text x="${mid}" y="${ty}" font-size="${fs}" fill="${col}" text-anchor="middle"${b}>${esc(text)}</text>`;
    ty += fs + 7;
  }
  function sep() {
    ty += 4;
    s += `<line x1="${cx+28}" y1="${ty}" x2="${cx+cw-28}" y2="${ty}" stroke="${C.border}" stroke-width="0.5" opacity="0.38"/>`;
    ty += 10;
  }

  row('紫微斗數命盤', 22, C.gold, true);
  if (name) row(name, 20, C.gold, true);
  row(chart.yinYang + '　' + chart.input.solarDate, 14, C.goldDim, false);
  row(chart.lunarDate, 14, C.goldDim, false);
  row(chart.chineseDate, 13, C.goldDim, false);
  row(chart.shichen, 13, C.goldDim, false);
  sep();
  row(chart.fiveElementsClass, 17, C.gold, true);
  if (chart.bodyPalace)
    row(`身宮：${chart.bodyPalace.name}（${chart.bodyPalace.stemBranch}）`, 13, C.body, false);
  if (chart.originalPalace)
    row(`來因宮：${chart.originalPalace.name}（${chart.originalPalace.stemBranch}）`, 13, C.original, false);
  sep();
  row('十年大運', 13, C.goldDim, false);

  const age    = calcAge(chart.input.solarDate);
  const sorted = [...chart.palaces].sort((a,b) => a.decadal[0] - b.decadal[0]);
  const colL   = mid - 120, colR = mid + 10;
  const rowH   = 19;

  for (let i = 0; i < sorted.length; i++) {
    const p   = sorted[i];
    const cur = age >= p.decadal[0] && age <= p.decadal[1];
    const lbl = `${p.name} ${p.decadal[0]}–${p.decadal[1]}`;
    if (i % 2 === 0) ty += rowH;
    const cx2 = i % 2 === 0 ? colL : colR;
    const b   = cur ? ' font-weight="bold"' : '';
    const col = cur ? C.current : C.goldDim;
    s += `<text x="${cx2}" y="${ty}" font-size="${13}" fill="${col}"${b}>${esc(lbl)}</text>`;
  }

  return s;
}

// ── SVG 組合 ─────────────────────────────────────────────────
function buildSVG(chart, name) {
  const branchMap = {};
  for (const p of chart.palaces) branchMap[p.stemBranch[1]] = p;

  const age = calcAge(chart.input.solarDate);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  svg += `<defs><style>text{font-family:"PingFang TC","Heiti TC","Microsoft JhengHei","STHeiti",serif;}</style></defs>`;
  svg += `<rect width="${W}" height="${H}" fill="${C.bg}"/>`;

  for (const [branch, [row, col]] of Object.entries(BRANCH_TO_GRID)) {
    const palace = branchMap[branch];
    if (!palace) continue;
    const isCurrent = age >= palace.decadal[0] && age <= palace.decadal[1];
    svg += renderPalace(palace, col*CELL, row*CELL, isCurrent);
  }

  svg += renderCenter(chart, name);
  svg += '</svg>';
  return svg;
}

// ── 主函式 ───────────────────────────────────────────────────
async function generateChartImage(solarDate, birthTime, gender, outputPng, options = {}) {
  const { Resvg } = require('@resvg/resvg-js');
  const chart  = generateChart(solarDate, birthTime, gender);
  const svgStr = buildSVG(chart, options.name || null);

  const svgPath = outputPng.replace(/\.png$/i, '.svg');
  fs.writeFileSync(svgPath, svgStr, 'utf8');
  console.log(`SVG → ${svgPath}`);

  const resvg = new Resvg(svgStr, {
    fitTo: { mode: 'width', value: Math.round(W * SCALE) },
    font:  { loadSystemFonts: true, defaultFontFamily: 'PingFang TC' },
  });
  fs.writeFileSync(outputPng, resvg.render().asPng());
  console.log(`PNG → ${outputPng}  (${Math.round(W*SCALE)}px)`);
}

// ── CLI ──────────────────────────────────────────────────────
if (require.main === module) {
  const [,,solarDate, birthTime, gender, output, name] = process.argv;
  if (!solarDate || !birthTime || !gender) {
    console.error('用法：node generate-chart-image.js YYYY-MM-DD HH:MM 男|女 [output.png] [姓名]');
    process.exit(1);
  }
  const outPath = output || path.join(__dirname, 'chart-output.png');
  generateChartImage(solarDate, birthTime, gender, outPath, { name })
    .then(() => console.log('完成'))
    .catch(e => { console.error(e); process.exit(1); });
}

module.exports = { generateChartImage };
