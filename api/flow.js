// Copyright (c) 2026 Blue.X. All Rights Reserved.
// Unauthorized copying, modification, or distribution is strictly prohibited.
"use strict";

const { generateChart } = require("../chart-api.js");
const { validateBirthData, validateQueryYear } = require("../lib/validate.js");
const L = require("../lib/liushi.js");
const { computeSeverity: computeLuJiSeverity } = require("../lib/lujiSeverity.js");

const HEAVENLY_STEMS    = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const EARTHLY_BRANCHES  = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const MUTAGEN_FULL      = ['化祿','化權','化科','化忌'];

const BLUE_SI_HUA_TABLE = {
  '甲': ['廉貞','破軍','武曲','太陽'],
  '乙': ['天機','天梁','紫微','太陰'],
  '丙': ['天同','天機','文昌','廉貞'],
  '丁': ['太陰','天同','天機','巨門'],
  '戊': ['貪狼','太陰','右弼','天機'],
  '己': ['武曲','貪狼','天梁','文曲'],
  '庚': ['太陽','武曲','天同','天相'],
  '辛': ['巨門','太陽','文曲','文昌'],
  '壬': ['天梁','紫微','左輔','武曲'],
  '癸': ['破軍','巨門','太陰','貪狼'],
};

function getYearStem(year)   { return HEAVENLY_STEMS[(year - 4) % 10]; }
function getYearBranch(year) { return EARTHLY_BRANCHES[(year - 4) % 12]; }

// 立春日（2月幾號）。優先用 lunar-typescript 的 getJieQiTable 取準確日，
// 取不到再 fall back 到近似公式（1900–2100 ±1 天精度）。
// ⚠️ 本檔內 lichunDay / birthGanZhiYear 只用於 chineseAge（虛歲）計算；
//    流年／流月命宮邊界以 Solar.fromYmd(...).getLunar().getYearInGanZhi()
//    的正月初一為準（見 lib/liushi.js）— 兩個界線並存、不要混用。
let _Solar = null;
try { _Solar = require("lunar-typescript").Solar; } catch (_) { /* graceful fallback */ }
function lichunDay(year) {
  if (_Solar) {
    try {
      const table = _Solar.fromYmd(year, 2, 15).getLunar().getJieQiTable();
      const jq = table['立春'];
      if (jq && jq.getYear() === year && jq.getMonth() === 2) return jq.getDay();
    } catch (_) { /* fall through to approximation */ }
  }
  const base = year >= 2000 ? 2000 : 1900;
  return Math.floor((year - base) * 0.2422 + 4.4475) - Math.floor((year - base) / 4);
}
// 出生日對應的干支年（立春前算前一年）
function birthGanZhiYear(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const lichun = lichunDay(y);
  if (m < 2 || (m === 2 && d < lichun)) return y - 1;
  return y;
}
// 紫微 / 命理 虛歲：以立春為界的干支年差 + 1
function chineseAge(birthDate, queryYear) {
  return queryYear - birthGanZhiYear(birthDate) + 1;
}

// ── 流年吉凶星（流祿/流羊/流陀/流馬/流昌/流曲/流魁/流鉞）─────────
// 表格依照標準紫微（中州派）口訣
const LU_BY_STEM    = { '甲':'寅','乙':'卯','丙':'巳','丁':'午','戊':'巳','己':'午','庚':'申','辛':'酉','壬':'亥','癸':'子' };
const CHANG_BY_STEM = { '甲':'巳','乙':'午','丙':'申','丁':'酉','戊':'申','己':'酉','庚':'亥','辛':'子','壬':'寅','癸':'卯' };
const QU_BY_STEM    = { '甲':'酉','乙':'申','丙':'午','丁':'巳','戊':'午','己':'巳','庚':'辰','辛':'卯','壬':'寅','癸':'丑' };
// 甲戊庚 魁丑鉞未；乙己 魁子鉞申；丙丁 魁亥鉞酉；壬癸 魁卯鉞巳；辛 魁午鉞寅
const KUI_BY_STEM   = { '甲':'丑','乙':'子','丙':'亥','丁':'亥','戊':'丑','己':'子','庚':'丑','辛':'午','壬':'卯','癸':'卯' };
const YUE_BY_STEM   = { '甲':'未','乙':'申','丙':'酉','丁':'酉','戊':'未','己':'申','庚':'未','辛':'寅','壬':'巳','癸':'巳' };
// 三合天馬：寅午戌→申、申子辰→寅、巳酉丑→亥、亥卯未→巳
const MA_BY_BRANCH  = {
  '寅':'申','午':'申','戌':'申',
  '申':'寅','子':'寅','辰':'寅',
  '巳':'亥','酉':'亥','丑':'亥',
  '亥':'巳','卯':'巳','未':'巳',
};
const BRANCH_ORDER = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
function shiftBranch(branch, n) {
  const i = BRANCH_ORDER.indexOf(branch);
  if (i < 0) return null;
  return BRANCH_ORDER[(i + n + 12) % 12];
}

function getFlowYearTransients(flowStem, flowBranch) {
  const lu = LU_BY_STEM[flowStem];
  return {
    '流祿': lu,
    '流羊': shiftBranch(lu, +1),  // 祿存後一位
    '流陀': shiftBranch(lu, -1),  // 祿存前一位
    '流馬': MA_BY_BRANCH[flowBranch] || null,
    '流昌': CHANG_BY_STEM[flowStem],
    '流曲': QU_BY_STEM[flowStem],
    '流魁': KUI_BY_STEM[flowStem],
    '流鉞': YUE_BY_STEM[flowStem],
  };
}

// 反查：每個地支上有哪些流年吉凶星
function getFlowTransientsByBranch(flowStem, flowBranch) {
  const t = getFlowYearTransients(flowStem, flowBranch);
  const map = {};
  for (const [name, br] of Object.entries(t)) {
    if (!br) continue;
    (map[br] = map[br] || []).push(name);
  }
  return map;
}

function getFlowYearMutagens(yearStem, palaces) {
  const stars = BLUE_SI_HUA_TABLE[yearStem] || [];
  return MUTAGEN_FULL.map((type, i) => {
    const star = stars[i] || null;
    const target = palaces.find(p =>
      p.majorStars.some(s => s.name === star) ||
      p.minorStars.some(s => s.name === star)
    );
    return {
      type,
      star,
      targetPalace:     target?.name       || null,
      targetStemBranch: target?.stemBranch  || null,
    };
  });
}

function getCurrentMajorLimit(majorLimits, queryYear) {
  return majorLimits.find(l =>
    queryYear >= l.startYear && queryYear <= l.endYear
  ) || null;
}

function getMinorLimitPalace(palaces, age) {
  // 優先使用 Blue's Version flowYearAges（更精確），fallback 到 iztro minorLimitAges
  return palaces.find(p =>
    Array.isArray(p.flowYearAges) && p.flowYearAges.includes(age)
  ) || palaces.find(p =>
    Array.isArray(p.minorLimitAges) && p.minorLimitAges.includes(age)
  ) || null;
}

// ── 流年命宮算法（Blue's Version v2）──────────────────────────
// 流年命宮 = 流年地支所對應的本命宮位
// 驗算（Blue 1987-05-19 陰男，丙午年 2026）：
//   流年地支=午 → 本命午宮=官祿 → 流命=官祿 ✓
function calcFlowYearLifePalace(palaces, flowYearBranch /*, yinYang*/) {
  return palaces.find(p => p.branch === flowYearBranch) ?? null;
}

function detectTripleStemOverlap(chart, currentMajorLimit) {
  const birthStem    = chart.fourPillars?.raw?.yearly?.[0]   || null;
  const origPalace   = chart.palaces.find(p => p.name === chart.originalPalace?.name);
  const originalStem = origPalace?.stem                       || null;
  const decadeStem   = currentMajorLimit?.stem                || null;

  const isTriple = !!(birthStem && originalStem && decadeStem &&
    birthStem === originalStem && originalStem === decadeStem);

  const matchCount = [
    birthStem === originalStem,
    birthStem === decadeStem,
    originalStem === decadeStem,
  ].filter(Boolean).length;

  return {
    birthYearStem:    birthStem,
    originalStem,
    decadeStem,
    isTripleOverlap:  isTriple,
    isDoubleOverlap:  !isTriple && matchCount >= 1,
    note: isTriple
      ? `三干疊加：生年干${birthStem}＝來因宮干${originalStem}＝大限干${decadeStem}，能量極度集中`
      : matchCount >= 1
        ? `雙干疊加：部分天干相同，能量有集中趨勢`
        : `無干疊加`,
  };
}

// ── 祿忌交戰偵測（增強版 v2 Blue's Version）───────────────────
// 涵蓋四種來源：生年四化、大限四化、流年四化、宮干飛化（incoming mutations）
// 任一星於同宮位同時被「祿」+「忌」化（來源不限），即構成祿忌交戰。
function detectLuJiConflict({
  palaces,
  yearMutagens = [],
  currentMajorLimit = null,
  flowYearMutagens = [],
  birthYearStem = null,
  flowYearStem = null,
}) {
  const conflicts = [];

  for (const palace of palaces) {
    // {star: {lu: [{src, stem}], ji: [{src, stem}]}}
    const starMutMap = {};

    const ensure = (star) => {
      if (!starMutMap[star]) starMutMap[star] = { lu: [], ji: [] };
      return starMutMap[star];
    };

    // 1. 生年四化
    for (const ym of yearMutagens) {
      if (ym.palace !== palace.name) continue;
      const slot = ensure(ym.star);
      if (ym.type === '化祿') slot.lu.push({ src: '生年', stem: birthYearStem });
      if (ym.type === '化忌') slot.ji.push({ src: '生年', stem: birthYearStem });
    }

    // 2. 大限四化
    for (const mut of (currentMajorLimit?.mutagens || [])) {
      if (mut.targetPalace !== palace.name) continue;
      const slot = ensure(mut.star);
      if (mut.type === '化祿') slot.lu.push({ src: '大限', stem: currentMajorLimit.stem });
      if (mut.type === '化忌') slot.ji.push({ src: '大限', stem: currentMajorLimit.stem });
    }

    // 3. 流年四化
    for (const fm of flowYearMutagens) {
      if (fm.targetPalace !== palace.name) continue;
      const slot = ensure(fm.star);
      if (fm.type === '化祿') slot.lu.push({ src: '流年', stem: flowYearStem });
      if (fm.type === '化忌') slot.ji.push({ src: '流年', stem: flowYearStem });
    }

    // 4. 宮干飛化（incoming mutations）— 來自其他本命宮的宮干飛入
    for (const inc of (palace.palaceMutagens?.incoming || [])) {
      const slot = ensure(inc.star);
      if (inc.type === '化祿') slot.lu.push({ src: inc.fromPalace, stem: inc.fromStem });
      if (inc.type === '化忌') slot.ji.push({ src: inc.fromPalace, stem: inc.fromStem });
    }

    // 5. 偵測衝突
    for (const [star, { lu, ji }] of Object.entries(starMutMap)) {
      if (lu.length > 0 && ji.length > 0) {
        const baseConflict = {
          palace:    palace.name,
          star,
          luSources: lu,
          jiSources: ji,
          note:      `${star}在${palace.name}：${lu.length}祿 vs ${ji.length}忌`,
        };
        // Sprint 4 v4.1：6 級 severity + 纏戰 pattern flag
        const sev = computeLuJiSeverity(baseConflict, palace, palaces);
        conflicts.push({
          ...baseConflict,
          severity:      sev.legacySeverity,  // 1-sprint 向下相容
          severityLevel: sev.level,
          levelLabel:    sev.label,
          pattern:       sev.pattern,
        });
      }
    }
  }

  return conflicts;
}

// ── 三盤疊宮 detector（A1, Blue 2026-06-27 / V1.1 step 3 缺口）─────────
// 汎天派 V1.1：「生年／大限／流年（天地人）三盤四化或忌星重疊於同一宮（流忌迭見），
// 大凶，重疊越多越凶；凡流祿飛入諸命宮其福加倍，流忌飛入諸命宮其凶加倍。」
//
// 輸出（公開層 math 骨架，象意判訣留 Tier 2 私有）：
//   sandipanOverlap: {
//     hasTripleOverlap: bool,                          // 三盤同宮 存在
//     overlaps: [                                      // 凡 ≥2 層共宮即列入
//       { palace, layerCount, layers:['生年','大限','流年'],
//         mutations:[{layer, star, type}], luCount, jiCount,
//         isJiAccumulated, isMingPalace, isFlowLifePalace }
//     ],
//     jiAccumulatedPalaces: [palace, ...],             // 流忌迭見（jiCount ≥ 2）
//     fortuneBoosts: [palace, ...],                    // 祿入諸命宮加倍
//     calamityBoosts: [palace, ...],                   // 忌入諸命宮加倍
//   }
function detectSandipanOverlap({
  palaces,
  yearMutagens = [],         // 生年四化（天盤）— item: { star, type, palace }
  currentMajorLimit = null,  // 大限四化（地盤）— mutagens item: { star, type, targetPalace }
  flowYearMutagens = [],     // 流年四化（人盤）— item: { star, type, targetPalace }
  flowYearLifePalaceName = null, // 流年命宮名（祿入諸命宮加倍判定用）
}) {
  // 1. 每宮收集三盤 mutations
  const perPalace = {};
  const ensure = (palName) => {
    if (!perPalace[palName]) perPalace[palName] = {
      palace: palName, mutations: [], layers: new Set(), luCount: 0, jiCount: 0,
    };
    return perPalace[palName];
  };

  for (const ym of yearMutagens) {
    if (!ym?.palace || !ym?.type) continue;
    const slot = ensure(ym.palace);
    slot.mutations.push({ layer: '生年', star: ym.star, type: ym.type });
    slot.layers.add('生年');
    if (ym.type === '化祿') slot.luCount++;
    if (ym.type === '化忌') slot.jiCount++;
  }
  for (const dm of (currentMajorLimit?.mutagens || [])) {
    if (!dm?.targetPalace || !dm?.type) continue;
    const slot = ensure(dm.targetPalace);
    slot.mutations.push({ layer: '大限', star: dm.star, type: dm.type });
    slot.layers.add('大限');
    if (dm.type === '化祿') slot.luCount++;
    if (dm.type === '化忌') slot.jiCount++;
  }
  for (const fm of flowYearMutagens) {
    if (!fm?.targetPalace || !fm?.type) continue;
    const slot = ensure(fm.targetPalace);
    slot.mutations.push({ layer: '流年', star: fm.star, type: fm.type });
    slot.layers.add('流年');
    if (fm.type === '化祿') slot.luCount++;
    if (fm.type === '化忌') slot.jiCount++;
  }

  // 2. 過濾 ≥2 層共宮的 entry + 加旗標
  const overlaps = [];
  const jiAccumulatedPalaces = [];
  const fortuneBoosts = [];   // 祿入諸命宮（本命/流年）
  const calamityBoosts = [];  // 忌入諸命宮（本命/流年）

  for (const palName of Object.keys(perPalace)) {
    const slot = perPalace[palName];
    const layerCount = slot.layers.size;
    const isJiAccumulated = slot.jiCount >= 2;
    const isMingPalace = palName === '命宮';
    const isFlowLifePalace = !!flowYearLifePalaceName && palName === flowYearLifePalaceName;

    if (layerCount >= 2) {
      overlaps.push({
        palace:           palName,
        layerCount,
        layers:           Array.from(slot.layers),
        mutations:        slot.mutations,
        luCount:          slot.luCount,
        jiCount:          slot.jiCount,
        isJiAccumulated,
        isMingPalace,
        isFlowLifePalace,
      });
    }
    if (isJiAccumulated) jiAccumulatedPalaces.push(palName);
    if ((isMingPalace || isFlowLifePalace) && slot.luCount > 0) fortuneBoosts.push(palName);
    if ((isMingPalace || isFlowLifePalace) && slot.jiCount > 0) calamityBoosts.push(palName);
  }

  // 3. 依嚴重度排序（layerCount desc, jiCount desc）
  overlaps.sort((a, b) => (b.layerCount - a.layerCount) || (b.jiCount - a.jiCount));

  return {
    hasTripleOverlap: overlaps.some(o => o.layerCount >= 3),
    overlaps,
    jiAccumulatedPalaces,
    fortuneBoosts,
    calamityBoosts,
  };
}

// ── 飛星派天地人三易合一 detector（A2, Blue 2026-06-27 / V1.1 step 3）─────
// 「以大限命宮飛星，看本命盤（天）、大限盤（地）、流年盤（人）三層象意是否重疊。」
// 本層只做骨架 math：對大限命宮干每顆四化星，分別對齊到本命/大限/流年三盤的對應宮名；
// 若三層宮名相同 → 三易合一；兩層相同 → 兩易合一。象意關聯 doctrine（婚姻=夫妻+
// 田宅+福德、事業=官祿+命宮+遷移、etc.）留 Tier 2 私有 bundle，公開層不洩。
//
// 宮位排法：紫微斗數十二宮 命→兄→夫→子→財→疾→遷→友→官→田→福→父，逆時針排
// 列。給定某盤命宮所在地支，可從本命地支反查它在該盤的第 N 宮 → 對應宮名。
const BRANCH_LIST_FLY = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const PALACES_12_FLY  = ['命宮','兄弟','夫妻','子女','財帛','疾厄','遷移','交友','官祿','田宅','福德','父母'];
function _branchToPalaceName(mingBranch, targetBranch) {
  const idxMing = BRANCH_LIST_FLY.indexOf(mingBranch);
  const idxTgt  = BRANCH_LIST_FLY.indexOf(targetBranch);
  if (idxMing < 0 || idxTgt < 0) return null;
  return PALACES_12_FLY[(idxMing - idxTgt + 12) % 12];
}

function detectFlyingStarTrinityOverlap({
  chart, currentMajorLimit, flowYearLifePalace,
}) {
  if (!currentMajorLimit || !flowYearLifePalace) return null;

  const natalMingBranch  = chart.palaces.find(p => p.name === '命宮')?.branch;
  const decadeMingBranch = chart.palaces.find(p => p.name === currentMajorLimit.palace)?.branch;
  const flowMingBranch   = flowYearLifePalace.branch;
  if (!natalMingBranch || !decadeMingBranch || !flowMingBranch) return null;

  const overlaps = [];
  for (const mut of (currentMajorLimit.mutagens || [])) {
    if (!mut?.targetPalace || !mut?.star) continue;
    const natalPal = chart.palaces.find(p => p.name === mut.targetPalace);
    if (!natalPal) continue;
    const tgtBranch = natalPal.branch;
    const layers = {
      natal:  mut.targetPalace,                                    // 天盤宮名（本命）
      decade: _branchToPalaceName(decadeMingBranch, tgtBranch),    // 地盤宮名（大限）
      flow:   _branchToPalaceName(flowMingBranch,   tgtBranch),    // 人盤宮名（流年）
    };

    const allThreeSame = layers.natal && layers.natal === layers.decade && layers.natal === layers.flow;
    const matchedPairs = [
      layers.natal === layers.decade ? 'natal+decade' : null,
      layers.natal === layers.flow   ? 'natal+flow'   : null,
      layers.decade === layers.flow  ? 'decade+flow'  : null,
    ].filter(Boolean);

    if (allThreeSame || matchedPairs.length > 0) {
      overlaps.push({
        star:             mut.star,
        type:             mut.type,
        sourceLayer:      '大限命宮干',
        targetBranch:     tgtBranch,
        layers,
        isTrinityUnified: !!allThreeSame,
        matchedPairs,
      });
    }
  }

  // 排序：三易合一優先，其次兩易合一（pairs 數量）
  overlaps.sort((a, b) =>
    (b.isTrinityUnified - a.isTrinityUnified) || (b.matchedPairs.length - a.matchedPairs.length)
  );

  return {
    mingBranches: { natal: natalMingBranch, decade: decadeMingBranch, flow: flowMingBranch },
    hasTrinityUnified: overlaps.some(o => o.isTrinityUnified),
    overlaps,
  };
}

// ── /api/flow?level=hour：本日吉凶時辰盤（汎天派流月/流日/流時順數）──────
const HOUR_BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

function handleHourLevel(req, res) {
  const { date, time, gender, targetDate } = req.query;
  if (!date || !time || !gender || !targetDate) {
    return res.status(400).json({
      error: '缺少必填參數',
      required: { date: 'YYYY-MM-DD', time: 'HH:MM', gender: '男|女', level: 'hour', targetDate: 'YYYY-MM-DD' },
      example: '/api/flow?date=2000-01-01&time=06:00&gender=男&level=hour&targetDate=2026-06-13',
    });
  }
  const bErr = validateBirthData({ date, time, gender });
  if (bErr) return res.status(400).json({ error: bErr });
  const tErr = validateBirthData({ date: targetDate, time: '12:00', gender }); // 借用日期格式/範圍檢查
  if (tErr) return res.status(400).json({ error: 'targetDate 格式錯誤，應為 YYYY-MM-DD（1900–2100）' });

  try {
    const chart   = generateChart(date, time, gender);
    const palaces  = chart.palaces;
    const lunar    = L.getTargetLunar(targetDate);

    // 四層命宮（順數法）
    const flowYearMing = palaces.find(p => p.branch === lunar.yearBranch) || null;
    if (!flowYearMing) return res.status(500).json({ error: '流年命宮定位失敗' });

    const monthStem  = L.flowMonthStem(lunar.yearStem, lunar.lunarMonth);
    const monthBr    = L.flowMonthPalace(flowYearMing.branch, lunar.lunarMonth);
    const monthMing  = palaces.find(p => p.branch === monthBr);

    const dayStem    = lunar.dayStem;
    const dayBr      = L.flowDayPalace(monthBr, lunar.lunarDay);
    const dayMing    = palaces.find(p => p.branch === dayBr);

    // 大限干（依目標年）
    const targetYear      = parseInt(targetDate.split('-')[0], 10);
    const currentMajorLimit = getCurrentMajorLimit(chart.majorLimits, targetYear);
    const birthYearStem   = chart.fourPillars?.raw?.yearly?.[0] || null;

    const hours = HOUR_BRANCHES.map(hb => {
      const hourStem  = L.flowHourStem(dayStem, hb);
      const hourBr    = L.flowHourPalace(dayBr, hb);
      const hourMing  = palaces.find(p => p.branch === hourBr);
      const layerStems = {
        生年: birthYearStem,
        大限: currentMajorLimit?.stem || null,
        流年: lunar.yearStem,
        流月: monthStem,
        流日: dayStem,
        流時: hourStem,
      };
      const sc  = L.scoreHourPalace(palaces, hourBr, layerStems);
      const dir = L.hourDirections(palaces, hourBr, hourStem);
      const m6  = L.buildMutagens6Layers(palaces, hourBr, layerStems);
      return {
        hourBranch:       hb,
        timeRange:        L.HOUR_TIME_RANGE[hb],
        stem:             hourStem,
        ganZhi:           hourStem + hb,
        mingPalaceBranch: hourBr,
        mingPalaceName:   hourMing?.name || null,
        score:            sc.score,
        grade:            sc.grade,
        symbol:           sc.symbol,
        factors:          sc.factors,
        directions:       dir,
        mutagens6layers:  m6,
      };
    });

    const ranked = [...hours].sort((a, b) => b.score - a.score);
    const best  = ranked[0];
    const worst = ranked[ranked.length - 1];

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Surrogate-Control', 'no-store');
    return res.status(200).json({
      query: { solarDate: date, birthTime: time, gender, targetDate, level: 'hour' },
      meta: {
        lunarMonth:  lunar.lunarMonth,
        lunarDay:    lunar.lunarDay,
        isLeapMonth: lunar.isLeapMonth,
        targetYearGanZhi: lunar.yearGanZhi,
        targetDayGanZhi:  lunar.dayGanZhi,
        method: '順數法（汎天派定盤鎖定）',
        note: '流時起法為汎天派順數法；近時辰邊界命主請先校正真太陽時',
      },
      flowYear: {
        ganZhi: lunar.yearGanZhi,
        mingPalaceBranch: flowYearMing.branch,
        mingPalaceName:   flowYearMing.name,
      },
      flowMonth: {
        lunarMonth: lunar.lunarMonth, stem: monthStem,
        mingPalaceBranch: monthBr, mingPalaceName: monthMing?.name || null,
      },
      flowDay: {
        ganZhi: lunar.dayGanZhi, lunarDay: lunar.lunarDay,
        mingPalaceBranch: dayBr, mingPalaceName: dayMing?.name || null,
      },
      hours,
      summary: {
        bestHour:  `${best.hourBranch}時`,
        worstHour: `${worst.hourBranch}時`,
        bestGrade: best.grade,
        worstGrade: worst.grade,
      },
    });
  } catch (err) {
    console.error('[/api/flow level=hour] error:', err);
    return res.status(500).json({ error: '流時分析失敗' });
  }
}

module.exports = function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  if (req.query.level === 'hour') return handleHourLevel(req, res);

  const { date, time, gender, year } = req.query;
  if (!date || !time || !gender || !year) {
    return res.status(400).json({
      error: '缺少必填參數',
      required: { date: 'YYYY-MM-DD', time: 'HH:MM', gender: '男|女', year: 'YYYY' },
      example: '/api/flow?date=2000-01-01&time=06:00&gender=男&year=2026',
    });
  }

  const bErr = validateBirthData({ date, time, gender });
  if (bErr) return res.status(400).json({ error: bErr });
  const yErr = validateQueryYear(year);
  if (yErr) return res.status(400).json({ error: yErr });
  const queryYear = parseInt(year, 10);

  try {
    const chart      = generateChart(date, time, gender);
    const birthYear  = parseInt(date.split('-')[0]);
    const age        = chineseAge(date, queryYear);
    const flowStem   = getYearStem(queryYear);
    const flowBranch = getYearBranch(queryYear);

    const flowYearMutagens  = getFlowYearMutagens(flowStem, chart.palaces);
    const flowYearTransients         = getFlowYearTransients(flowStem, flowBranch);
    const flowYearTransientsByBranch = getFlowTransientsByBranch(flowStem, flowBranch);
    const currentMajorLimit = getCurrentMajorLimit(chart.majorLimits, queryYear);
    const minorLimitPalace  = getMinorLimitPalace(chart.palaces, age);

    // 流年命宮（覆寫 iztro 預設值）
    const flowLifePalace    = calcFlowYearLifePalace(chart.palaces, flowBranch);

    const tripleStemOverlap = detectTripleStemOverlap(chart, currentMajorLimit);
    const birthYearStem     = chart.fourPillars?.raw?.yearly?.[0] || null;
    const luJiConflicts     = detectLuJiConflict({
      palaces:           chart.palaces,
      yearMutagens:      chart.yearMutagens || [],
      currentMajorLimit,
      flowYearMutagens,
      birthYearStem,
      flowYearStem:      flowStem,
    });
    // A1（Blue 2026-06-27）：三盤疊宮 detector — 生年/大限/流年共宮 + 流忌迭見 + 祿/忌入命宮加倍
    const sandipanOverlap = detectSandipanOverlap({
      palaces:                chart.palaces,
      yearMutagens:           chart.yearMutagens || [],
      currentMajorLimit,
      flowYearMutagens,
      flowYearLifePalaceName: flowLifePalace?.name || null,
    });
    // A2（Blue 2026-06-27）：飛星派天地人三易合一 — 大限命宮干飛化於本命/大限/流年三層宮名對齊
    const trinityOverlap = detectFlyingStarTrinityOverlap({
      chart,
      currentMajorLimit,
      flowYearLifePalace: flowLifePalace,
    });

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Surrogate-Control', 'no-store');
    return res.status(200).json({
      query: { solarDate: date, birthTime: time, gender, queryYear },

      flowYear: {
        year:        queryYear,
        stem:        flowStem,
        branch:      flowBranch,
        ganZhi:      flowStem + flowBranch,
        chineseAge:  age,
      },

      // 流年吉凶星：流祿/流羊/流陀/流馬/流昌/流曲/流魁/流鉞
      flowYearTransients,             // { 流祿: '巳', 流羊: '午', ... }
      flowYearTransientsByBranch,     // { '巳': ['流祿'], '午': ['流羊'], ... }

      // 占驗派流年命宮（Blue's Version 算法覆寫）
      flowYearLifePalace: flowLifePalace ? {
        name:             flowLifePalace.name,
        stemBranch:       flowLifePalace.stemBranch,
        stem:             flowLifePalace.stem,
        branch:           flowLifePalace.branch,
        majorStars:       flowLifePalace.majorStars.map(s => s.name),
        isBodyPalace:     flowLifePalace.isBodyPalace,
        isOriginalPalace: flowLifePalace.isOriginalPalace,
        algorithm:        '流年命宮 = 流年地支對應本命宮位',
      } : null,

      // 小限宮（另立欄位，與流年命宮分開）
      minorLimitPalace: minorLimitPalace ? {
        name:             minorLimitPalace.name,
        stemBranch:       minorLimitPalace.stemBranch,
        stem:             minorLimitPalace.stem,
        branch:           minorLimitPalace.branch,
        majorStars:       minorLimitPalace.majorStars.map(s => s.name),
        isBodyPalace:     minorLimitPalace.isBodyPalace,
        isOriginalPalace: minorLimitPalace.isOriginalPalace,
      } : null,

      flowYearMutagens,

      currentMajorLimit: currentMajorLimit ? {
        order:      currentMajorLimit.order,
        palace:     currentMajorLimit.palace,
        stemBranch: currentMajorLimit.stemBranch,
        stem:       currentMajorLimit.stem,
        startAge:   currentMajorLimit.startAge,
        endAge:     currentMajorLimit.endAge,
        startYear:  currentMajorLimit.startYear,
        endYear:    currentMajorLimit.endYear,
        mutagens:   currentMajorLimit.mutagens,
      } : null,

      tripleStemOverlap,
      sandipanOverlap,
      trinityOverlap,
      luJiConflicts,
      hasLuJiConflict: luJiConflicts.length > 0,
      luJiConflictSummary: luJiConflicts.map(c => ({
        palace:        c.palace,
        star:          c.star,
        severity:      c.severity,
        severityLevel: c.severityLevel,
        levelLabel:    c.levelLabel,
        pattern:       c.pattern,
        note:          c.note,
      })),

      birthYearMutagens: chart.yearMutagens,

      allPalaceMinorLimitAges: chart.palaces.map(p => ({
        name:              p.name,
        stemBranch:        p.stemBranch,
        flowYearAges:      p.flowYearAges      || null,  // Blue's Version（優先）
        minorLimitAges:    p.minorLimitAges    || null,  // iztro 原始值（參考）
      })),
    });

  } catch (err) {
    console.error('[/api/flow] error:', err);
    return res.status(500).json({ error: '流年分析失敗' });
  }
};
