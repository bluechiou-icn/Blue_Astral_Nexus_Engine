// Copyright (c) 2026 Blue.X. All Rights Reserved.
// Unauthorized copying, modification, or distribution is strictly prohibited.
"use strict";

const { generateChart } = require("../chart-api.js");

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
function chineseAge(birthYear, queryYear) { return queryYear - birthYear + 1; }

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

module.exports = function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  const { date, time, gender, year } = req.query;
  if (!date || !time || !gender || !year) {
    return res.status(400).json({
      error: '缺少必填參數',
      required: { date: 'YYYY-MM-DD', time: 'HH:MM', gender: '男|女', year: 'YYYY' },
      example: '/api/flow?date=2000-01-01&time=06:00&gender=男&year=2026',
    });
  }

  const queryYear = parseInt(year);
  if (isNaN(queryYear) || queryYear < 1900 || queryYear > 2100) {
    return res.status(400).json({ error: 'year 須為 1900–2100 整數' });
  }

  try {
    const chart      = generateChart(date, time, gender);
    const birthYear  = parseInt(date.split('-')[0]);
    const age        = chineseAge(birthYear, queryYear);
    const flowStem   = getYearStem(queryYear);
    const flowBranch = getYearBranch(queryYear);

    const flowYearMutagens  = getFlowYearMutagens(flowStem, chart.palaces);
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

      birthYearMutagens: chart.yearMutagens,

      allPalaceMinorLimitAges: chart.palaces.map(p => ({
        name:              p.name,
        stemBranch:        p.stemBranch,
        flowYearAges:      p.flowYearAges      || null,  // Blue's Version（優先）
        minorLimitAges:    p.minorLimitAges    || null,  // iztro 原始值（參考）
      })),
    });

  } catch (err) {
    return res.status(500).json({ error: '流年分析失敗', message: err.message });
  }
};
