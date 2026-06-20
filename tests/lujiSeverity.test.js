// Sprint 4 v4.1 — 祿忌交戰 severity 單元測試
// Spec:    docs/sprints/20260619_Sprint4_Spec_v4.1_LJ_conflict_upgrade.md
// Cassian: handoff/20260620_Cassian_Sprint4_v4.1_Severity.md
// Run:     node --test tests/lujiSeverity.test.js

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { computeSeverity, NATAL_CORE_TRINE_UNION } = require('../lib/lujiSeverity.js');

// ────────────────────────────────────────────────────────────
// Test fixtures：fixture palace 必須提供 conflict.star 的 brightnessRank
// ────────────────────────────────────────────────────────────
function palaceWithStar(name, starName, brightnessRank) {
  return {
    name,
    isEmpty: false,
    majorStars: [{ name: starName, brightnessRank }],
    minorStars: [],
    borrowedFromPalace: null,
    borrowedStars: null,
  };
}

function emptyPalaceBorrowing(name, fromPalaceName, starName) {
  return {
    name,
    isEmpty: true,
    majorStars: [],
    minorStars: [],
    borrowedFromPalace: fromPalaceName,
    borrowedStars: [starName],
  };
}

function srcLayer(label, stem = '甲') {
  return { src: label, stem };
}

// ────────────────────────────────────────────────────────────
// L1：1祿 + 1忌，同一層（僅生年）→ Level 1
// ────────────────────────────────────────────────────────────
test('L1 — 1祿1忌同層（生年）→ level 1 輕微', () => {
  const palace = palaceWithStar('交友宮', '紫微', 1);
  const conflict = {
    palace: '交友宮', star: '紫微',
    luSources: [srcLayer('生年')],
    jiSources: [srcLayer('生年')],
  };
  const r = computeSeverity(conflict, palace, [palace]);
  assert.equal(r.level, 1);
  assert.equal(r.label, '輕微');
  assert.equal(r.legacySeverity, null);
  assert.equal(r.pattern, null);
});

// ────────────────────────────────────────────────────────────
// L2：1祿 + 1忌，跨 2 層（生年 + 大限）→ Level 2
// ────────────────────────────────────────────────────────────
test('L2 — 1祿1忌跨層（生年+大限）→ level 2 輕度', () => {
  const palace = palaceWithStar('交友宮', '紫微', 1);
  const conflict = {
    palace: '交友宮', star: '紫微',
    luSources: [srcLayer('生年')],
    jiSources: [srcLayer('大限')],
  };
  const r = computeSeverity(conflict, palace, [palace]);
  assert.equal(r.level, 2);
  assert.equal(r.label, '輕度');
  assert.equal(r.legacySeverity, 'medium');
});

// ────────────────────────────────────────────────────────────
// L3：2祿+1忌，亮度低（rank 5 平）→ Level 3
// ────────────────────────────────────────────────────────────
test('L3 — 2祿1忌 + 亮度中或以下（平/rank 5）→ level 3 中度', () => {
  const palace = palaceWithStar('夫妻宮', '天同', 5);
  const conflict = {
    palace: '夫妻宮', star: '天同',
    luSources: [srcLayer('生年'), srcLayer('大限')],
    jiSources: [srcLayer('流年')],
  };
  const r = computeSeverity(conflict, palace, [palace]);
  assert.equal(r.level, 3);
  assert.equal(r.label, '中度');
  assert.equal(r.legacySeverity, 'medium');
});

// ────────────────────────────────────────────────────────────
// L4：1祿+2忌，亮度高（廟/rank 1）→ Level 4
// ────────────────────────────────────────────────────────────
test('L4 — 1祿2忌 + 亮度高（廟/rank 1）→ level 4 偏重度', () => {
  const palace = palaceWithStar('夫妻宮', '武曲', 1);
  const conflict = {
    palace: '夫妻宮', star: '武曲',
    luSources: [srcLayer('生年')],
    jiSources: [srcLayer('大限'), srcLayer('流年')],
  };
  const r = computeSeverity(conflict, palace, [palace]);
  assert.equal(r.level, 4);
  assert.equal(r.label, '偏重度');
  assert.equal(r.legacySeverity, 'high');
});

// ────────────────────────────────────────────────────────────
// L5：4 sources，亮度低（不滿足 L6 三條件）→ Level 5
//      使用非 trine union 宮位（例：父母宮）+ 亮度 rank 5
// ────────────────────────────────────────────────────────────
test('L5 — 4 sources + 亮度低 + 落非核心三方 → level 5 重度', () => {
  const palace = palaceWithStar('父母宮', '天梁', 5);
  const conflict = {
    palace: '父母宮', star: '天梁',
    luSources: [srcLayer('生年'), srcLayer('大限')],
    jiSources: [srcLayer('流年'), srcLayer('流月')],
  };
  // 父母宮 不在 natal core trine union（10 宮排除 交友、父母）
  assert.equal(NATAL_CORE_TRINE_UNION.has('父母宮'), false);
  const r = computeSeverity(conflict, palace, [palace]);
  assert.equal(r.level, 5);
  assert.equal(r.label, '重度');
  assert.equal(r.legacySeverity, 'high');
  // E1 纏戰 pattern：2 祿 + 2 忌 → flag
  assert.equal(r.pattern, 'luji_chanzhan');
});

// ────────────────────────────────────────────────────────────
// L6 primary：4 sources + 亮度高 + 落 trine union（財帛宮）→ Level 6
// ────────────────────────────────────────────────────────────
test('L6 primary — 4 sources + 亮度高 + 三方 union → level 6 嚴重度', () => {
  const palace = palaceWithStar('財帛宮', '太陽', 2);
  const conflict = {
    palace: '財帛宮', star: '太陽',
    luSources: [srcLayer('生年'), srcLayer('大限')],
    jiSources: [srcLayer('流年'), srcLayer('流月')],
  };
  assert.equal(NATAL_CORE_TRINE_UNION.has('財帛宮'), true);
  const r = computeSeverity(conflict, palace, [palace]);
  assert.equal(r.level, 6);
  assert.equal(r.label, '嚴重度');
  assert.equal(r.legacySeverity, 'critical');
  assert.equal(r.pattern, 'luji_chanzhan');
});

// ────────────────────────────────────────────────────────────
// L6 override（Blue 啟用）：3 sources + 落命宮 → 直接 Level 6
//   即使亮度低（rank 7 陷）也跳到 L6
// ────────────────────────────────────────────────────────────
test('L6 override — 3 sources + 落命宮 + 即便亮度陷（rank 7） → level 6', () => {
  const palace = palaceWithStar('命宮', '巨門', 7);
  const conflict = {
    palace: '命宮', star: '巨門',
    luSources: [srcLayer('生年')],
    jiSources: [srcLayer('大限'), srcLayer('流年')],
  };
  const r = computeSeverity(conflict, palace, [palace]);
  assert.equal(r.level, 6);
  assert.equal(r.label, '嚴重度');
  assert.equal(r.legacySeverity, 'critical');
});

// ────────────────────────────────────────────────────────────
// E1 完整斷言：纏戰 pattern 在 ≥2 祿 + ≥2 忌 時必觸發
// ────────────────────────────────────────────────────────────
test('E1 — 纏戰 pattern flag（2祿2忌同星）+ 亮度旺 + trine → L6 + chanzhan', () => {
  const palace = palaceWithStar('遷移宮', '貪狼', 2);  // 旺（高亮度）
  const conflict = {
    palace: '遷移宮', star: '貪狼',
    luSources: [srcLayer('生年'), srcLayer('大限')],
    jiSources: [srcLayer('生年'), srcLayer('大限')],
  };
  const r = computeSeverity(conflict, palace, [palace]);
  assert.equal(r.pattern, 'luji_chanzhan');
  // 遷移宮 ∈ union + 亮度旺(rank 2 ≤ 2) + 4 sources → L6
  assert.equal(r.level, 6);
});

test('E1 — 纏戰 pattern 在亮度低時仍 flag（但 level 降為 L5）', () => {
  const palace = palaceWithStar('父母宮', '貪狼', 5);  // 平（非高）+ 父母宮 不在 union
  const conflict = {
    palace: '父母宮', star: '貪狼',
    luSources: [srcLayer('生年'), srcLayer('大限')],
    jiSources: [srcLayer('生年'), srcLayer('大限')],
  };
  const r = computeSeverity(conflict, palace, [palace]);
  assert.equal(r.pattern, 'luji_chanzhan', '纏戰 flag 與 level 解耦');
  assert.equal(r.level, 5);
});

// ────────────────────────────────────────────────────────────
// E3 借宮：palace.isEmpty=true，conflict.star 須從 borrowedFromPalace 查 brightness
// ────────────────────────────────────────────────────────────
test('E3 借宮 — brightness 從對宮 majorStars 查回，不能跳 null', () => {
  // 田宅宮 (空宮) 借 子女宮 (天府廟/rank 1) 的星
  const tianZhai = emptyPalaceBorrowing('田宅宮', '子女宮', '天府');
  const ziNu = palaceWithStar('子女宮', '天府', 1);
  const conflict = {
    palace: '田宅宮', star: '天府',
    luSources: [srcLayer('生年'), srcLayer('大限')],
    jiSources: [srcLayer('流年'), srcLayer('流月')],
  };
  // 田宅宮 ∈ union → 預期 L6（亮度高 + trine + 4 sources）
  const r = computeSeverity(conflict, tianZhai, [tianZhai, ziNu]);
  assert.equal(r.level, 6, '借宮 brightness 應正確查到 rank 1，觸發 L6');
  assert.equal(r.pattern, 'luji_chanzhan');
});

// ────────────────────────────────────────────────────────────
// 邊界：layer 計數正確排除自化/向心化（src=palace name → 全收 palaceFlight 單層）
// ────────────────────────────────────────────────────────────
test('layer 計數 — 多個宮干飛化收成單一 palaceFlight 層', () => {
  const palace = palaceWithStar('交友宮', '七殺', 4);
  const conflict = {
    palace: '交友宮', star: '七殺',
    luSources: [{ src: '官祿宮', stem: '甲' }],
    jiSources: [{ src: '田宅宮', stem: '乙' }],
  };
  // 2 個 sources 都是宮干飛化 → distinct_layers = 1（palaceFlight）→ L1
  const r = computeSeverity(conflict, palace, [palace]);
  assert.equal(r.level, 1, '兩個 palaceFlight src 應收成單層 → L1');
});

// ────────────────────────────────────────────────────────────
// 邊界：legacy severity mapping 完整覆蓋
// ────────────────────────────────────────────────────────────
test('legacy severity mapping — 1→null, 2/3→medium, 4/5→high, 6→critical', () => {
  const mapCases = [
    [1, null], [2, 'medium'], [3, 'medium'],
    [4, 'high'], [5, 'high'], [6, 'critical'],
  ];
  const { LEGACY_SEVERITY } = require('../lib/lujiSeverity.js');
  for (const [lvl, exp] of mapCases) {
    assert.equal(LEGACY_SEVERITY[lvl], exp, `level ${lvl} → ${exp}`);
  }
});
