// Copyright (c) 2026 Blue.X. All Rights Reserved.
// 流時推算模組 — 汎天派流月／流日／流時順數演算法 + 本日運勢評分
// 起法皆為「順數法」，由 Blue 啟靈事件（2023-01-22 癸卯初一）定盤鎖定。
// 規格來源：Cassian 引擎升級規格 2026-06-10。本檔僅含流時相關純函式，
// 不改動既有流年邏輯（surgical）。
"use strict";

const { Solar } = require("lunar-typescript");
const { BLUE_SI_HUA_TABLE } = require("../chart-api.js");

const STEMS    = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
const BRANCHES = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];

// 五虎遁：年干／大限干 → 正月(寅月)天干起點
const WUHU_DUN = {
  "甲":"丙","己":"丙",  // 甲己之年丙作首
  "乙":"戊","庚":"戊",  // 乙庚之歲戊為頭
  "丙":"庚","辛":"庚",  // 丙辛必定尋庚起
  "丁":"壬","壬":"壬",  // 丁壬壬位順行流
  "戊":"甲","癸":"甲",  // 戊癸甲寅求
};

// 五鼠遁：日干 → 子時天干起點
const WUSHU_DUN = {
  "甲":"甲","己":"甲",  // 甲己還加甲
  "乙":"丙","庚":"丙",  // 乙庚丙作初
  "丙":"戊","辛":"戊",  // 丙辛從戊起
  "丁":"庚","壬":"庚",  // 丁壬庚子居
  "戊":"壬","癸":"壬",  // 戊癸壬子途
};

// 地支八方對照（方位輸出用）
const BRANCH_DIRECTION = {
  "子":"正北","丑":"東北","寅":"東北","卯":"正東",
  "辰":"東南","巳":"東南","午":"正南","未":"西南",
  "申":"西南","酉":"正西","戌":"西北","亥":"西北",
};

// 十二時辰鐘錶對照
const HOUR_TIME_RANGE = {
  "子":"23:00-01:00","丑":"01:00-03:00","寅":"03:00-05:00","卯":"05:00-07:00",
  "辰":"07:00-09:00","巳":"09:00-11:00","午":"11:00-13:00","未":"13:00-15:00",
  "申":"15:00-17:00","酉":"17:00-19:00","戌":"19:00-21:00","亥":"21:00-23:00",
};

// 流時天魁／天鉞（依流時干，標準紫微口訣）— 貴人方用
// 甲戊庚 魁丑鉞未；乙己 魁子鉞申；丙丁 魁亥鉞酉；辛 魁午鉞寅；壬癸 魁卯鉞巳
const KUI_BY_STEM = { "甲":"丑","乙":"子","丙":"亥","丁":"亥","戊":"丑","己":"子","庚":"丑","辛":"午","壬":"卯","癸":"卯" };
const YUE_BY_STEM = { "甲":"未","乙":"申","丙":"酉","丁":"酉","戊":"未","己":"申","庚":"未","辛":"寅","壬":"巳","癸":"巳" };

const LUCKY_STARS = ["左輔","右弼","文昌","文曲","天魁","天鉞","祿存","天馬"];
const SHA_STARS   = ["擎羊","陀羅","火星","鈴星","地空","地劫"];

// ── 農曆轉換（春節邊界以農曆年為準，禁止西元年心算）──────────
/**
 * 取目標陽曆日期的農曆資訊。流年干支用 getYearInGanZhi()（正月初一為界），
 * 符合紫微流年定義。
 * @param {string} targetDate YYYY-MM-DD
 */
function getTargetLunar(targetDate) {
  const [y, m, d] = targetDate.split("-").map(Number);
  const lunar = Solar.fromYmd(y, m, d).getLunar();
  const yearGanZhi = lunar.getYearInGanZhi();   // 例：癸卯
  const dayGanZhi  = lunar.getDayInGanZhi();    // 例：庚辰
  return {
    lunarMonth:  Math.abs(lunar.getMonth()),    // 閏月為負，取絕對值
    lunarDay:    lunar.getDay(),
    isLeapMonth: lunar.getMonth() < 0,
    yearGanZhi,
    yearStem:    yearGanZhi[0],
    yearBranch:  yearGanZhi[1],
    dayGanZhi,
    dayStem:     dayGanZhi[0],
  };
}

// ── 核心演算法（順數法，汎天派標準）──────────────────────────

/** 流月命宮 = 流年命宮為正月，順數至目標農曆月 */
function flowMonthPalace(flowYearMingBranch, lunarMonth) {
  const startIdx = BRANCHES.indexOf(flowYearMingBranch);
  return BRANCHES[(startIdx + (lunarMonth - 1)) % 12];
}

/** 流月天干（五虎遁定正月天干，順推至目標月） */
function flowMonthStem(flowYearStem, lunarMonth) {
  const startIdx = STEMS.indexOf(WUHU_DUN[flowYearStem]);
  return STEMS[(startIdx + (lunarMonth - 1)) % 10];
}

/** 流日命宮 = 流月命宮為初一，順數至目標農曆日 */
function flowDayPalace(flowMonthMingBranch, lunarDay) {
  const startIdx = BRANCHES.indexOf(flowMonthMingBranch);
  return BRANCHES[(startIdx + (lunarDay - 1)) % 12];
}

/** 流時命宮 = 流日命宮為子時，順數至目標時辰 */
function flowHourPalace(flowDayMingBranch, hourBranch) {
  const startIdx = BRANCHES.indexOf(flowDayMingBranch);
  const hourIdx  = BRANCHES.indexOf(hourBranch); // 子=0
  return BRANCHES[(startIdx + hourIdx) % 12];
}

/** 流時天干（五鼠遁定子時天干，順推至目標時辰） */
function flowHourStem(flowDayStem, hourBranch) {
  const startIdx = STEMS.indexOf(WUSHU_DUN[flowDayStem]);
  const hourIdx  = BRANCHES.indexOf(hourBranch); // 子=0
  return STEMS[(startIdx + hourIdx) % 10];
}

// ── 評分輔助 ────────────────────────────────────────────────

/** 收集一個宮位內的全部星名（主星＋輔小星）。空宮回傳借星名。 */
function palaceStarNames(palace) {
  const names = [];
  for (const s of (palace.majorStars || [])) names.push(s.name);
  for (const s of (palace.minorStars || [])) names.push(s.name);
  if (palace.isEmpty && Array.isArray(palace.borrowedStars)) {
    for (const n of palace.borrowedStars) names.push(n);
  }
  return names;
}

/** 取得某天干四化 → { 化祿:星, 化權:星, 化科:星, 化忌:星 } */
function mutagenStarsByStem(stem) {
  const arr = BLUE_SI_HUA_TABLE[stem];
  if (!arr) return null;
  return { 化祿: arr[0], 化權: arr[1], 化科: arr[2], 化忌: arr[3] };
}

const byBranch = (palaces, branch) => palaces.find(p => p.branch === branch) || null;

/**
 * 三方四正地支：命宮本宮、對宮(+6)、三合(+4 / -4)
 */
function triadBranches(mingBranch) {
  const i = BRANCHES.indexOf(mingBranch);
  return [
    mingBranch,
    BRANCHES[(i + 6) % 12],
    BRANCHES[(i + 4) % 12],
    BRANCHES[(i + 8) % 12],
  ];
}

/**
 * 評估單一時辰流時命宮吉凶（三派加權）。
 * @param {object[]} palaces  本命十二宮（流時盤沿用本命星佈，僅重定命宮）
 * @param {string}   mingBranch 流時命宮地支
 * @param {object}   layerStems { 生年, 大限, 流年, 流月, 流日, 流時 } 天干
 * @returns { score, grade, symbol, factors }
 */
function scoreHourPalace(palaces, mingBranch, layerStems) {
  let score = 0;
  const factors = [];
  const palace = byBranch(palaces, mingBranch);
  if (!palace) return { score: 0, grade: "平", symbol: "★", factors: ["流時命宮未定位"] };

  const emptyFactor = palace.isEmpty ? 0.5 : 1; // 空宮借星力量減半

  // ── 三合派 30%：主星亮度 + 命宮三方四正吉煞星 ──
  const brightStars = palace.isEmpty ? [] : (palace.majorStars || []);
  for (const s of brightStars) {
    let v = 0;
    if (["廟","旺"].includes(s.brightness)) v = 2;
    else if (["得","利"].includes(s.brightness)) v = 1;
    else if (["不利","陷","不"].includes(s.brightness)) v = -2;
    if (v !== 0) { score += v * emptyFactor; factors.push(`${s.name}${s.brightness}${v > 0 ? "+" : ""}${v * emptyFactor}`); }
  }
  // 空宮借星亮度（×0.5）
  if (palace.isEmpty) {
    const src = byBranch(palaces, BRANCHES[(BRANCHES.indexOf(mingBranch) + 6) % 12]);
    for (const s of (src?.majorStars || [])) {
      let v = 0;
      if (["廟","旺"].includes(s.brightness)) v = 2;
      else if (["得","利"].includes(s.brightness)) v = 1;
      else if (["不利","陷","不"].includes(s.brightness)) v = -2;
      if (v !== 0) { score += v * 0.5; factors.push(`借${s.name}${s.brightness}${(v * 0.5) > 0 ? "+" : ""}${v * 0.5}`); }
    }
  }
  // 命宮 + 三方四正 吉煞星（每顆 ±1）
  for (const br of triadBranches(mingBranch)) {
    const p = byBranch(palaces, br);
    for (const s of (p?.minorStars || [])) {
      if (LUCKY_STARS.includes(s.name)) { score += 1; factors.push(`${s.name}+1`); }
      else if (SHA_STARS.includes(s.name)) { score -= 1; factors.push(`${s.name}-1`); }
    }
  }

  // ── 占驗派 50%：六層四化（生年/大限/流年/流月/流日/流時）──
  const palaceStars = new Set(palaceStarNames(palace));
  // 每顆落在流時命宮的星，逐層紀錄被祿/忌打的層數
  const starLu = {}; // star -> [layer...]
  const starJi = {};
  const LAYER_ORDER = ["生年","大限","流年","流月","流日","流時"];
  for (const layer of LAYER_ORDER) {
    const stem = layerStems[layer];
    if (!stem) continue;
    const m = mutagenStarsByStem(stem);
    if (!m) continue;
    if (palaceStars.has(m.化祿)) { score += 2; factors.push(`${layer}${m.化祿}祿+2`); (starLu[m.化祿] ||= []).push(layer); }
    if (palaceStars.has(m.化權)) { score += 1; factors.push(`${layer}${m.化權}權+1`); }
    if (palaceStars.has(m.化科)) { score += 1; factors.push(`${layer}${m.化科}科+1`); }
    if (palaceStars.has(m.化忌)) { score -= 3; factors.push(`${layer}${m.化忌}忌-3`); (starJi[m.化忌] ||= []).push(layer); }
  }
  // 同星祿忌交戰 -2
  for (const star of Object.keys(starLu)) {
    if (starJi[star]) { score -= 2; factors.push(`${star}祿忌交戰-2`); }
  }
  // 多層化祿疊加（≥3 層）額外 +2
  const totalLuLayers = Object.values(starLu).reduce((a, l) => a + l.length, 0);
  if (totalLuLayers >= 3) { score += 2; factors.push(`多層化祿(${totalLuLayers})+2`); }
  // 多層化忌疊加（≥2 層）額外 -3
  const totalJiLayers = Object.values(starJi).reduce((a, l) => a + l.length, 0);
  if (totalJiLayers >= 2) { score -= 3; factors.push(`多層化忌(${totalJiLayers})-3`); }

  // ── 飛星派 20%：流時宮干自化 + 飛化 ──
  const hourStem = layerStems["流時"];
  const hm = mutagenStarsByStem(hourStem);
  if (hm) {
    // 自化：化星落於流時命宮本宮
    if (palaceStars.has(hm.化祿)) { score += 1; factors.push(`自化祿+1`); }
    if (palaceStars.has(hm.化權)) { score += 1; factors.push(`自化權+1`); }
    if (palaceStars.has(hm.化科)) { score += 1; factors.push(`自化科+1`); }
    if (palaceStars.has(hm.化忌)) { score -= 3; factors.push(`自化忌-3`); }
    // 飛化：流時宮干四化星落於流時盤哪個地支
    const i = BRANCHES.indexOf(mingBranch);
    const luckyTargets = new Set([mingBranch, BRANCHES[(i - 4 + 12) % 12], BRANCHES[(i - 8 + 12) % 12], BRANCHES[(i - 6 + 12) % 12]]); // 命/財/官/遷
    const harmTargets  = new Set([mingBranch, BRANCHES[(i - 2 + 12) % 12], BRANCHES[(i - 5 + 12) % 12]]);                              // 命/夫/疾
    const luBranch = starBranch(palaces, hm.化祿);
    const jiBranch = starBranch(palaces, hm.化忌);
    if (luBranch && luckyTargets.has(luBranch) && luBranch !== mingBranch) { score += 1; factors.push(`飛祿入命財官遷+1`); }
    if (jiBranch && harmTargets.has(jiBranch)  && jiBranch !== mingBranch) { score -= 2; factors.push(`飛忌入命夫疾-2`); }
  }

  // ── 評級 ──
  let grade, symbol;
  if (score >= 6)       { grade = "大吉"; symbol = "★★★"; }
  else if (score >= 3)  { grade = "吉";   symbol = "★★"; }
  else if (score >= -2) { grade = "平";   symbol = "★"; }
  else if (score >= -5) { grade = "小凶"; symbol = "☆"; }
  else                  { grade = "凶";   symbol = "☆☆"; }

  return { score: Math.round(score * 10) / 10, grade, symbol, factors };
}

/** 找某星曜（主星）所在本命宮地支 */
function starBranch(palaces, starName) {
  if (!starName) return null;
  const p = palaces.find(pp =>
    (pp.majorStars || []).some(s => s.name === starName) ||
    (pp.minorStars || []).some(s => s.name === starName)
  );
  return p ? p.branch : null;
}

// ── 方位輸出 ────────────────────────────────────────────────
/**
 * 四種方位：吉方 / 貴人方 / 財位方 / 避凶方
 * @param palaces 本命宮（流時盤沿用）
 * @param mingBranch 流時命宮地支
 * @param hourStem 流時天干（定流時魁鉞）
 */
function hourDirections(palaces, mingBranch, hourStem) {
  const i = BRANCHES.indexOf(mingBranch);
  const caiBranch = BRANCHES[(i - 4 + 12) % 12]; // 流時財帛宮地支
  const kui = KUI_BY_STEM[hourStem], yue = YUE_BY_STEM[hourStem];

  // 貴人方：流時天魁／天鉞所在地支（取魁為主）
  const guiBranch = kui || yue;

  // 財位方：流時財帛宮地支。若財帛宮坐流時化忌則為破財方，需避（回傳 null + 標記）
  const hm = mutagenStarsByStem(hourStem);
  const caiPalace = byBranch(palaces, caiBranch);
  const caiStars = caiPalace ? new Set(palaceStarNames(caiPalace)) : new Set();
  const caiIsBroken = !!(hm && caiStars.has(hm.化忌));

  // 避凶方：流時命宮被化忌沖（對宮飛忌入命），則對宮地支為避凶方
  const oppBranch = BRANCHES[(i + 6) % 12];
  const oppPalace = byBranch(palaces, oppBranch);
  const oppOutgoing = oppPalace?.palaceMutagens?.outgoing || [];
  const oppJiIntoMing = oppOutgoing.some(o => o.type === "化忌" && o.targetPalace && byBranch(palaces, mingBranch)?.name === o.targetPalace);

  return {
    吉方:   BRANCH_DIRECTION[mingBranch] || null,
    貴人方: guiBranch ? (BRANCH_DIRECTION[guiBranch] || null) : null,
    財位方: caiIsBroken ? null : (BRANCH_DIRECTION[caiBranch] || null),
    財位破: caiIsBroken,
    避凶方: oppJiIntoMing ? (BRANCH_DIRECTION[oppBranch] || null) : null,
  };
}

module.exports = {
  STEMS, BRANCHES, WUHU_DUN, WUSHU_DUN, BRANCH_DIRECTION, HOUR_TIME_RANGE,
  getTargetLunar,
  flowMonthPalace, flowMonthStem,
  flowDayPalace,
  flowHourPalace, flowHourStem,
  scoreHourPalace, hourDirections,
};
