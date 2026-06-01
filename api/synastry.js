// Copyright (c) 2026 Blue.X. All Rights Reserved.
// Unauthorized copying, modification, or distribution is strictly prohibited.
"use strict";

const { generateChart } = require("../chart-api.js");

const MUTAGEN_FULL = ['化祿','化權','化科','化忌'];

// ÆTHNOUS BlueVersion 四化對照表（與 chart-api 保持一致）
const BLUE_SI_HUA_TABLE = {
  '甲':['廉貞','破軍','武曲','太陽'],
  '乙':['天機','天梁','紫微','太陰'],
  '丙':['天同','天機','文昌','廉貞'],
  '丁':['太陰','天同','天機','巨門'],
  '戊':['貪狼','太陰','右弼','天機'],
  '己':['武曲','貪狼','天梁','文曲'],
  '庚':['太陽','武曲','天同','天相'],
  '辛':['巨門','太陽','文曲','文昌'],
  '壬':['天梁','紫微','左輔','武曲'],
  '癸':['破軍','巨門','太陰','貪狼'],
};

/**
 * 計算 A 的某個天干四化，落在 B 的哪些宮位。
 * @param {string} fromStem - 天干（甲乙丙…）
 * @param {string} fromLabel - 標籤文字（如 "A生年干乙"）
 * @param {Array} toPalaces - 對方的 palaces 陣列
 * @returns {Array<{stem, source, type, star, targetPalaceName, targetStemBranch, note}>}
 */
function calcCrossFlyingTransformations(fromStem, fromLabel, toPalaces) {
  const stars = BLUE_SI_HUA_TABLE[fromStem] || [];
  return MUTAGEN_FULL.map((type, i) => {
    const star = stars[i] || null;
    const targetPalace = toPalaces.find(p =>
      p.majorStars.some(s => s.name === star) ||
      p.minorStars.some(s => s.name === star)
    );
    return {
      stem: fromStem,
      source: fromLabel,
      type,
      star,
      targetPalaceName: targetPalace?.name || null,
      targetStemBranch: targetPalace?.stemBranch || null,
      note: targetPalace
        ? `${fromLabel}${type}（${star}）→ 對方${targetPalace.name}宮`
        : `${fromLabel}${type}（${star}）→ 未落入對方主星宮位`,
    };
  });
}

/**
 * 偵測雙盤共振結構（身宮、來因、田宅雙祿等）
 */
function detectResonances(chart1, chart2) {
  const resonances = [];

  const body1Branch = chart1.palaces.find(p => p.isBodyPalace)?.branch;
  const body2Branch = chart2.palaces.find(p => p.isBodyPalace)?.branch;
  const orig1Branch = chart1.palaces.find(p => p.isOriginalPalace)?.branch;
  const orig2Branch = chart2.palaces.find(p => p.isOriginalPalace)?.branch;
  const ming1Branch = chart1.palaces.find(p => p.name === '命宮')?.branch;
  const ming2Branch = chart2.palaces.find(p => p.name === '命宮')?.branch;

  // 雙身宮同宮
  if (body1Branch && body2Branch && body1Branch === body2Branch) {
    resonances.push({
      type: '雙身宮共振',
      branch: body1Branch,
      note: `雙方身宮皆在${body1Branch}，身宮能量高度共振`,
    });
  }

  // 雙來因宮同宮
  if (orig1Branch && orig2Branch && orig1Branch === orig2Branch) {
    resonances.push({
      type: '雙來因宮共振',
      branch: orig1Branch,
      note: `雙方來因宮皆在${orig1Branch}，業力連結深厚`,
    });
  }

  // A 身宮地支 = B 命宮地支
  if (body1Branch && ming2Branch && body1Branch === ming2Branch) {
    resonances.push({
      type: 'A身宮入B命宮',
      branch: body1Branch,
      note: `A的身宮地支（${body1Branch}）= B的命宮地支，A的核心能量直接映射B的命格`,
    });
  }
  if (body2Branch && ming1Branch && body2Branch === ming1Branch) {
    resonances.push({
      type: 'B身宮入A命宮',
      branch: body2Branch,
      note: `B的身宮地支（${body2Branch}）= A的命宮地支`,
    });
  }

  // 田宅雙祿：A 化祿 → B 田宅，B 化祿 → A 田宅
  const tianzhai1 = chart1.palaces.find(p => p.name === '田宅');
  const tianzhai2 = chart2.palaces.find(p => p.name === '田宅');
  const birthStem1 = chart1.fourPillars?.raw?.yearly?.[0];
  const birthStem2 = chart2.fourPillars?.raw?.yearly?.[0];

  if (birthStem1 && tianzhai2) {
    const lukStar1 = BLUE_SI_HUA_TABLE[birthStem1]?.[0];
    const lukLands1InTianzhai2 = tianzhai2.majorStars.some(s => s.name === lukStar1) ||
                                 tianzhai2.minorStars.some(s => s.name === lukStar1);
    if (lukLands1InTianzhai2) {
      resonances.push({
        type: 'A生年化祿入B田宅',
        star: lukStar1,
        note: `A生年干${birthStem1}化祿（${lukStar1}）→ B的田宅宮，A對B的居所財庫有祿化助益`,
      });
    }
  }
  if (birthStem2 && tianzhai1) {
    const lukStar2 = BLUE_SI_HUA_TABLE[birthStem2]?.[0];
    const lukLands2InTianzhai1 = tianzhai1.majorStars.some(s => s.name === lukStar2) ||
                                 tianzhai1.minorStars.some(s => s.name === lukStar2);
    if (lukLands2InTianzhai1) {
      resonances.push({
        type: 'B生年化祿入A田宅',
        star: lukStar2,
        note: `B生年干${birthStem2}化祿（${lukStar2}）→ A的田宅宮`,
      });
    }
  }

  return resonances;
}

module.exports = function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  const { date1, time1, gender1, city1,
          date2, time2, gender2, city2 } = req.query;

  if (!date1 || !time1 || !gender1 || !date2 || !time2 || !gender2) {
    return res.status(400).json({
      error: '缺少必填參數',
      required: {
        chart1: { date1: 'YYYY-MM-DD', time1: 'HH:MM', gender1: '男|女' },
        chart2: { date2: 'YYYY-MM-DD', time2: 'HH:MM', gender2: '男|女' },
      },
      optional: { city1: '出生城市', city2: '出生城市' },
      example: '/api/synastry?date1=2000-01-01&time1=06:00&gender1=男&date2=2000-01-02&time2=06:00&gender2=女',
    });
  }

  try {
    const chart1 = generateChart(date1, time1, gender1, city1 || null);
    const chart2 = generateChart(date2, time2, gender2, city2 || null);

    const birthStem1 = chart1.fourPillars?.raw?.yearly?.[0];
    const birthStem2 = chart2.fourPillars?.raw?.yearly?.[0];

    const now = new Date().getFullYear();
    const currentMajorLimit1 = chart1.majorLimits?.find(l => now >= l.startYear && now <= l.endYear);
    const currentMajorLimit2 = chart2.majorLimits?.find(l => now >= l.startYear && now <= l.endYear);

    const synastry = {
      // A 生年四化 → B 命盤
      chart1BirthYearToChart2: birthStem1
        ? calcCrossFlyingTransformations(birthStem1, `A生年干${birthStem1}`, chart2.palaces)
        : [],

      // B 生年四化 → A 命盤
      chart2BirthYearToChart1: birthStem2
        ? calcCrossFlyingTransformations(birthStem2, `B生年干${birthStem2}`, chart1.palaces)
        : [],

      // A 當前大限四化 → B 命盤
      chart1CurrentDecadeToChart2: currentMajorLimit1
        ? calcCrossFlyingTransformations(
            currentMajorLimit1.stem,
            `A大限干${currentMajorLimit1.stem}（${currentMajorLimit1.palace}）`,
            chart2.palaces
          )
        : [],

      // B 當前大限四化 → A 命盤
      chart2CurrentDecadeToChart1: currentMajorLimit2
        ? calcCrossFlyingTransformations(
            currentMajorLimit2.stem,
            `B大限干${currentMajorLimit2.stem}（${currentMajorLimit2.palace}）`,
            chart1.palaces
          )
        : [],

      // 共振偵測
      resonances: detectResonances(chart1, chart2),

      chart1CurrentDecade: currentMajorLimit1 ? {
        palace: currentMajorLimit1.palace,
        stem:   currentMajorLimit1.stem,
        range:  `${currentMajorLimit1.startYear}-${currentMajorLimit1.endYear}`,
      } : null,

      chart2CurrentDecade: currentMajorLimit2 ? {
        palace: currentMajorLimit2.palace,
        stem:   currentMajorLimit2.stem,
        range:  `${currentMajorLimit2.startYear}-${currentMajorLimit2.endYear}`,
      } : null,
    };

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Surrogate-Control', 'no-store');
    return res.status(200).json({
      chart1: { ...chart1, _label: 'A' },
      chart2: { ...chart2, _label: 'B' },
      synastry,
    });

  } catch (err) {
    return res.status(500).json({ error: '合盤分析失敗', message: err.message });
  }
};
