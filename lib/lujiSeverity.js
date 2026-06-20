// Sprint 4 v4.1 — 祿忌交戰 6 級 severity 判定
// Spec:    docs/sprints/20260619_Sprint4_Spec_v4.1_LJ_conflict_upgrade.md §二
// 對齊：    Cassian 2026-06-20 reply + Blue 兩條 override
//   - L6 命宮直擊 override: 啟用
//   - Q5b 三方判定: 寬鬆解（任一邊落 union 即觸發，不限化忌側）

'use strict';

const LEVEL_LABEL = {
  1: '輕微', 2: '輕度', 3: '中度', 4: '偏重度', 5: '重度', 6: '嚴重度',
};

// Legacy 3-tier mapping for 1-sprint 向下相容
// Cassian: 1→null, 2→medium, 3→medium, 4→high, 5→high, 6→critical
const LEGACY_SEVERITY = {
  1: null, 2: 'medium', 3: 'medium', 4: 'high', 5: 'high', 6: 'critical',
};

// 本命盤 命/官/財/田 的三方四正 union（10 個宮位，排除 交友、父母）
const NATAL_CORE_TRINE_UNION = new Set([
  '命宮', '兄弟宮', '夫妻宮', '子女宮', '財帛宮', '疾厄宮',
  '遷移宮', '官祿宮', '田宅宮', '福德宮',
]);

const LAYER_LABELS = {
  birth: '生年', decade: '大限', year: '流年',
  month: '流月', day: '流日', hour: '流時',
  palaceFlight: '宮干飛化',
};

// src field in luSources/jiSources → canonical layer key
// 自化/向心化 與宮干飛化全部收成「palaceFlight」單一層別（Cassian Q1：同 layer 內多條算 1 層）
function layerOfSource(src) {
  if (src === '生年') return 'birth';
  if (src === '大限') return 'decade';
  if (src === '流年') return 'year';
  if (src === '流月') return 'month';
  if (src === '流日') return 'day';
  if (src === '流時') return 'hour';
  return 'palaceFlight';
}

function distinctLayers(luSources, jiSources) {
  const set = new Set();
  for (const s of luSources) set.add(layerOfSource(s.src));
  for (const s of jiSources) set.add(layerOfSource(s.src));
  return set.size;
}

// E3 借宮：palace.isEmpty=true 時用 borrowedFromPalace 查 brightnessRank
function brightnessRankOf(starName, palace, allPalaces) {
  if (!palace) return null;
  const hit = palace.majorStars?.find(s => s.name === starName);
  if (hit && hit.brightnessRank != null) return hit.brightnessRank;
  if (palace.isEmpty && palace.borrowedFromPalace && Array.isArray(palace.borrowedStars) && palace.borrowedStars.includes(starName)) {
    const src = allPalaces?.find(p => p.name === palace.borrowedFromPalace);
    const bhit = src?.majorStars?.find(s => s.name === starName);
    if (bhit && bhit.brightnessRank != null) return bhit.brightnessRank;
  }
  const mhit = palace.minorStars?.find(s => s.name === starName);
  if (mhit && mhit.brightnessRank != null) return mhit.brightnessRank;
  return null;
}

// Cassian Q3/Q5a：取沖突涉及主星的 min(brightnessRank)（數字越小越亮）
// 當前 conflict schema 只有 conflict.star 一顆星（per-star aggregation），所以 set 通常 size=1
function minBrightnessRank(conflict, palace, allPalaces) {
  const stars = new Set([conflict.star]);
  let min = Infinity;
  for (const s of stars) {
    const rank = brightnessRankOf(s, palace, allPalaces);
    if (rank != null && rank < min) min = rank;
  }
  return min === Infinity ? null : min;
}

// E1 纏戰偵測：同星 ≥2 祿 + ≥2 忌 → luji_chanzhan pattern flag
function detectChanzhan(luSources, jiSources) {
  return luSources.length >= 2 && jiSources.length >= 2 ? 'luji_chanzhan' : null;
}

// Q5b（Blue 寬鬆）：landing palace ∈ union OR 任一 source palace ∈ union 即觸發
// 注意：layer 字串（生年/大限/...）天然不在 palace name set 內，只有 宮干飛化 src=palace name 才會比中
function inNatalCoreTrine(conflict, palace) {
  if (NATAL_CORE_TRINE_UNION.has(palace?.name)) return true;
  for (const s of [...conflict.luSources, ...conflict.jiSources]) {
    if (s.src && NATAL_CORE_TRINE_UNION.has(s.src)) return true;
  }
  return false;
}

// L6 override（Blue 啟用）：total ≥ 3 + ji 落在命宮（直接頂級，跳過亮度/三方）
function isMingDirectStrike(conflict, palace) {
  const total = conflict.luSources.length + conflict.jiSources.length;
  if (total < 3) return false;
  return palace?.name === '命宮';
}

function computeSeverity(conflict, palace, allPalaces) {
  const luN = conflict.luSources.length;
  const jiN = conflict.jiSources.length;
  const total = luN + jiN;
  if (luN === 0 || jiN === 0) {
    return { level: null, label: null, legacySeverity: null, pattern: null };
  }

  const pattern = detectChanzhan(conflict.luSources, conflict.jiSources);

  if (isMingDirectStrike(conflict, palace)) {
    return wrap(6, pattern);
  }

  const minRank = minBrightnessRank(conflict, palace, allPalaces);
  const inTrine = inNatalCoreTrine(conflict, palace);

  if (total >= 4) {
    if (minRank !== null && minRank <= 2 && inTrine) return wrap(6, pattern);
    return wrap(5, pattern);
  }
  if (total === 3) {
    if (minRank !== null && minRank <= 2) return wrap(4, pattern);
    return wrap(3, pattern);
  }
  // total === 2 (luN===1 && jiN===1)
  const layers = distinctLayers(conflict.luSources, conflict.jiSources);
  return wrap(layers >= 2 ? 2 : 1, pattern);
}

function wrap(level, pattern) {
  return {
    level,
    label: LEVEL_LABEL[level],
    legacySeverity: LEGACY_SEVERITY[level],
    pattern,
  };
}

module.exports = {
  computeSeverity,
  LEVEL_LABEL,
  LEGACY_SEVERITY,
  NATAL_CORE_TRINE_UNION,
  LAYER_LABELS,
  // exposed for tests
  _internal: {
    distinctLayers,
    minBrightnessRank,
    brightnessRankOf,
    detectChanzhan,
    inNatalCoreTrine,
    isMingDirectStrike,
    layerOfSource,
  },
};
