import pkg from "iztro";
import { createRequire } from "module";

const { astro } = pkg;
const require = createRequire(import.meta.url);
const { timeToIndex, SHICHEN_NAMES } = require("./utils.js");

astro.config({ language: "zh-TW" });

function printChart(label, solarDate, birthTime, gender) {
  const timeIndex = timeToIndex(birthTime);
  const result = astro.bySolar(solarDate, timeIndex, gender, true);

  console.log(`\n══ ${label} ══`);
  console.log(`生日：${solarDate} ${birthTime}　時辰：${SHICHEN_NAMES[timeIndex]}（timeIndex=${timeIndex}）`);
  console.log(`農曆：${result.lunarDate}`);
  console.log(`五行局：${result.fiveElementsClass}`);
  console.log("── 十二宮主星 ─────────────────────────────");
  result.palaces.forEach(p => {
    const stars = p.majorStars.map(s => s.name).join("、") || "（無主星）";
    const body = p.isBodyPalace ? " ★身宮" : "";
    console.log(`${p.name}（${p.heavenlyStem}${p.earthlyBranch}）：${stars}${body}`);
  });
}

// ── Blue：YYYY-MM-DD 05:17 男，預期金四局 ──
printChart("Blue", "YYYY-MM-DD", "05:17", "男");

// ── Sean：YYYY-MM-DD 05:30 男，預期水二局，命宮廉貞天相在子宮 ──
printChart("Sean", "YYYY-MM-DD", "05:30", "男");
