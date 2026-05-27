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
  return palaces.find(p =>
    Array.isArray(p.minorLimitAges) && p.minorLimitAges.includes(age)
  ) || null;
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

function detectLuJiConflict(flowMutagens, decadeMutagens, birthMutagens) {
  const all = [
    ...flowMutagens.map(m  => ({ ...m, source: '流年' })),
    ...decadeMutagens.map(m => ({ ...m, source: '大限' })),
    ...birthMutagens.map(m  => ({ ...m, source: '生年' })),
  ];
  const conflicts = [];
  const luList = all.filter(m => m.type === '化祿');
  const jiList = all.filter(m => m.type === '化忌');
  for (const lu of luList) {
    for (const ji of jiList) {
      if (lu.star === ji.star && lu.targetPalace === ji.targetPalace && lu.source !== ji.source) {
        conflicts.push({
          star:      lu.star,
          palace:    lu.targetPalace,
          luSource:  lu.source,
          jiSource:  ji.source,
          note:      `${lu.star}在${lu.targetPalace}：${lu.source}化祿 vs ${ji.source}化忌，形成祿忌交戰`,
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

    const tripleStemOverlap = detectTripleStemOverlap(chart, currentMajorLimit);
    const luJiConflicts     = detectLuJiConflict(
      flowYearMutagens,
      currentMajorLimit?.mutagens || [],
      chart.yearMutagens || []
    );

    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).json({
      query: { solarDate: date, birthTime: time, gender, queryYear },

      flowYear: {
        year:        queryYear,
        stem:        flowStem,
        branch:      flowBranch,
        ganZhi:      flowStem + flowBranch,
        chineseAge:  age,
      },

      flowYearLifePalace: minorLimitPalace ? {
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
        name:           p.name,
        stemBranch:     p.stemBranch,
        minorLimitAges: p.minorLimitAges || null,
      })),
    });

  } catch (err) {
    return res.status(500).json({ error: '流年分析失敗', message: err.message });
  }
};
