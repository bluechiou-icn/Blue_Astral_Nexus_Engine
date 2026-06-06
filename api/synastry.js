// Copyright (c) 2026 Blue.X. All Rights Reserved.
// Unauthorized copying, modification, or distribution is strictly prohibited.
"use strict";

const { generateChart } = require("../chart-api.js");
const { validateBirthData } = require("../lib/validate.js");

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

  const body1 = chart1.palaces.find(p => p.isBodyPalace);
  const body2 = chart2.palaces.find(p => p.isBodyPalace);
  const orig1 = chart1.palaces.find(p => p.isOriginalPalace);
  const orig2 = chart2.palaces.find(p => p.isOriginalPalace);
  const ming1 = chart1.palaces.find(p => p.name === '命宮');
  const ming2 = chart2.palaces.find(p => p.name === '命宮');
  const tian1 = chart1.palaces.find(p => p.name === '田宅');
  const tian2 = chart2.palaces.find(p => p.name === '田宅');

  const stem1 = chart1.fourPillars?.raw?.yearly?.[0];
  const stem2 = chart2.fourPillars?.raw?.yearly?.[0];

  // ── 雙身宮同地支 ─────────────────────────────
  if (body1?.branch && body2?.branch && body1.branch === body2.branch) {
    resonances.push({
      type: '雙身宮共振',
      direction: '對稱',
      branch: body1.branch,
      note: `雙方身宮皆在${body1.branch}，身宮能量高度共振`,
    });
  }

  // ── 雙來因宮同地支 ────────────────────────────
  if (orig1?.branch && orig2?.branch && orig1.branch === orig2.branch) {
    resonances.push({
      type: '雙來因宮共振',
      direction: '對稱',
      branch: orig1.branch,
      note: `雙方來因宮皆在${orig1.branch}，業力連結深厚`,
    });
  }

  // ── 身宮 ↔ 命宮 互映（雙向對稱）─────────────
  if (body1?.branch && ming2?.branch && body1.branch === ming2.branch) {
    resonances.push({
      type: 'A身宮映B命宮',
      direction: 'A→B',
      branch: body1.branch,
      note: `A身宮（${body1.branch}）= B命宮地支，A核心能量直接映射B命格`,
    });
  }
  if (body2?.branch && ming1?.branch && body2.branch === ming1.branch) {
    resonances.push({
      type: 'B身宮映A命宮',
      direction: 'B→A',
      branch: body2.branch,
      note: `B身宮（${body2.branch}）= A命宮地支，B核心能量直接映射A命格`,
    });
  }

  // ── 來因宮 ↔ 命宮 互映（雙向對稱）───────────
  if (orig1?.branch && ming2?.branch && orig1.branch === ming2.branch) {
    resonances.push({
      type: 'A來因宮映B命宮',
      direction: 'A→B',
      branch: orig1.branch,
      note: `A來因宮（${orig1.branch}）= B命宮地支，業力入口對準B命格`,
    });
  }
  if (orig2?.branch && ming1?.branch && orig2.branch === ming1.branch) {
    resonances.push({
      type: 'B來因宮映A命宮',
      direction: 'B→A',
      branch: orig2.branch,
      note: `B來因宮（${orig2.branch}）= A命宮地支`,
    });
  }

  // ── 田宅四化雙向偵測（祿+權+科+忌各自雙向）─────────────
  function starInPalace(palace, star) {
    if (!palace || !star) return false;
    return palace.majorStars.some(s => s.name === star) ||
           palace.minorStars.some(s => s.name === star);
  }

  const MUTAGEN_LABELS = ['化祿','化權','化科','化忌'];

  for (let mi = 0; mi < 4; mi++) {
    const star1 = stem1 ? BLUE_SI_HUA_TABLE[stem1]?.[mi] : null;
    const star2 = stem2 ? BLUE_SI_HUA_TABLE[stem2]?.[mi] : null;
    const label = MUTAGEN_LABELS[mi];

    // A 的四化星落 B 的田宅
    if (star1 && tian2 && starInPalace(tian2, star1)) {
      resonances.push({
        type: `A生年${label}入B田宅`,
        direction: 'A→B',
        star: star1,
        note: `A生年干${stem1}${label}（${star1}）→ B田宅宮`,
      });
    }

    // B 的四化星落 A 的田宅
    if (star2 && tian1 && starInPalace(tian1, star2)) {
      resonances.push({
        type: `B生年${label}入A田宅`,
        direction: 'B→A',
        star: star2,
        note: `B生年干${stem2}${label}（${star2}）→ A田宅宮`,
      });
    }
  }

  // 田宅雙向祿+權格：A→B 且 B→A 各有祿或權時，合計為格局
  const aToBLukOrKuen = resonances.filter(r =>
    r.direction === 'A→B' && r.type.includes('田宅') &&
    (r.type.includes('化祿') || r.type.includes('化權'))
  );
  const bToALukOrKuen = resonances.filter(r =>
    r.direction === 'B→A' && r.type.includes('田宅') &&
    (r.type.includes('化祿') || r.type.includes('化權'))
  );
  if (aToBLukOrKuen.length > 0 && bToALukOrKuen.length > 0) {
    resonances.push({
      type: '田宅祿權雙向格',
      direction: '對稱',
      note: `雙方互將祿或權化入對方田宅，田宅能量高度交織`,
    });
  }

  // ── 雙方身宮 ↔ 來因宮 互映 ───────────────────
  if (body1?.branch && orig2?.branch && body1.branch === orig2.branch) {
    resonances.push({
      type: 'A身宮映B來因宮',
      direction: 'A→B',
      branch: body1.branch,
      note: `A身宮（${body1.branch}）= B來因宮地支，A的靈魂核心與B的業力入口共振`,
    });
  }
  if (body2?.branch && orig1?.branch && body2.branch === orig1.branch) {
    resonances.push({
      type: 'B身宮映A來因宮',
      direction: 'B→A',
      branch: body2.branch,
      note: `B身宮（${body2.branch}）= A來因宮地支`,
    });
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

  const e1 = validateBirthData({ date: date1, time: time1, gender: gender1, city: city1 }, 'A');
  if (e1) return res.status(400).json({ error: e1 });
  const e2 = validateBirthData({ date: date2, time: time2, gender: gender2, city: city2 }, 'B');
  if (e2) return res.status(400).json({ error: e2 });

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
    console.error('[/api/synastry] error:', err);
    return res.status(500).json({ error: '合盤分析失敗' });
  }
};
