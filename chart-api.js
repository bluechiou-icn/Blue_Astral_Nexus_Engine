"use strict";

const pkg = require("iztro");
const { astro, util } = pkg;
const { timeToIndex, SHICHEN_NAMES } = require("./utils.js");

astro.config({ language: "zh-TW" });

const MUTAGEN_KEYS = ["祿", "權", "科", "忌"];

/**
 * 產生紫微斗數命盤 JSON
 *
 * @param {string} solarDate  西曆生日 "YYYY-MM-DD"
 * @param {string} birthTime  出生時間 "HH:MM"
 * @param {string} gender     性別 "男" | "女"
 * @returns {object} 完整命盤資料
 */
function generateChart(solarDate, birthTime, gender) {
  const timeIndex = timeToIndex(birthTime);
  const r = astro.bySolar(solarDate, timeIndex, gender, true);

  // ── 身宮 ──────────────────────────────────────────────────
  const bodyPalace = r.palaces.find(p => p.isBodyPalace);

  // ── 來因宮（宮干與生年干相同者） ──────────────────────────
  const originalPalace = r.palaces.find(p => p.isOriginalPalace);

  // ── 生年四化 ──────────────────────────────────────────────
  const yearStem = r.rawDates.chineseDate.yearly[0];
  const mutagenStars = util.getMutagensByHeavenlyStem(yearStem);
  const yearMutagens = mutagenStars.map((star, i) => {
    const palace = r.palaces.find(p =>
      p.majorStars.some(s => s.name === star) ||
      p.minorStars.some(s => s.name === star)
    );
    return {
      type: `化${MUTAGEN_KEYS[i]}`,
      star,
      palace: palace?.name ?? null,
      palaceStemBranch: palace ? palace.heavenlyStem + palace.earthlyBranch : null,
    };
  });

  // ── 十二宮位 ──────────────────────────────────────────────
  const palaces = r.palaces.map(p => ({
    name: p.name,
    stemBranch: p.heavenlyStem + p.earthlyBranch,
    isBodyPalace: p.isBodyPalace,
    isOriginalPalace: p.isOriginalPalace,
    majorStars: p.majorStars.map(s => s.name),
  }));

  return {
    input: { solarDate, birthTime, gender },
    lunarDate: r.lunarDate,
    chineseDate: r.chineseDate,
    shichen: SHICHEN_NAMES[timeIndex],
    fiveElementsClass: r.fiveElementsClass,
    bodyPalace: bodyPalace
      ? { name: bodyPalace.name, stemBranch: bodyPalace.heavenlyStem + bodyPalace.earthlyBranch }
      : null,
    originalPalace: originalPalace
      ? { name: originalPalace.name, stemBranch: originalPalace.heavenlyStem + originalPalace.earthlyBranch }
      : null,
    yearMutagens,
    palaces,
  };
}

module.exports = { generateChart };

// ── CLI 入口：node chart-api.js YYYY-MM-DD HH:MM 男|女 ───────
if (require.main === module) {
  const [, , solarDate, birthTime, gender] = process.argv;
  if (!solarDate || !birthTime || !gender) {
    console.error("用法：node chart-api.js YYYY-MM-DD HH:MM 男|女");
    process.exit(1);
  }
  const result = generateChart(solarDate, birthTime, gender);
  console.log(JSON.stringify(result, null, 2));
}
