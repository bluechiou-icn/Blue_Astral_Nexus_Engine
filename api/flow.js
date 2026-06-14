// Copyright (c) 2026 Blue.X. All Rights Reserved.
// Unauthorized copying, modification, or distribution is strictly prohibited.
"use strict";

const { generateChart } = require("../chart-api.js");
const { validateBirthData, validateQueryYear } = require("../lib/validate.js");
const L = require("../lib/liushi.js");

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

// 立春日（2月幾號），近似公式適用 1900–2100
function lichunDay(year) {
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
        const total = lu.length + ji.length;
        const severity = total >= 4 ? 'critical' : total >= 3 ? 'high' : 'medium';
        conflicts.push({
          palace:    palace.name,
          star,
          luSources: lu,
          jiSources: ji,
          severity,
          note:      `${star}在${palace.name}：${lu.length}祿 vs ${ji.length}忌`,
        });
      }
    }
  }

  return conflicts;
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
      const sc = L.scoreHourPalace(palaces, hourBr, layerStems);
      const dir = L.hourDirections(palaces, hourBr, hourStem);
      return {
        hourBranch:      hb,
        timeRange:       L.HOUR_TIME_RANGE[hb],
        stem:            hourStem,
        ganZhi:          hourStem + hb,
        mingPalaceBranch: hourBr,
        mingPalaceName:  hourMing?.name || null,
        score:           sc.score,
        grade:           sc.grade,
        symbol:          sc.symbol,
        factors:         sc.factors,
        directions:      dir,
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
      luJiConflicts,
      hasLuJiConflict: luJiConflicts.length > 0,
      luJiConflictSummary: luJiConflicts.map(c => ({
        palace:   c.palace,
        star:     c.star,
        severity: c.severity,
        note:     c.note,
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
