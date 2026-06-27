// 格局 registry 單元測試
// Run: node --test tests/formations.test.js
// 註：fixtures 一律使用範例資料，無任何真實生辰（CLAUDE.md Rule 3）。
"use strict";

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  detectClassicalFormations,
  _internal: { trineBranchesOf, isAdjBranch },
} = require('../lib/formations.js');

// ── fixtures ──────────────────────────────────────────────
function P(name, branch, opts = {}) {
  return {
    name, branch,
    isEmpty: opts.isEmpty ?? false,
    majorStars: opts.major ?? [],
    minorStars: opts.minor ?? [],
    borrowedFromPalace: opts.borrowedFromPalace ?? null,
    borrowedStars: opts.borrowedStars ?? null,
  };
}
const s = (name, extra = {}) => ({ name, ...extra });
const names = formations => formations.map(f => f.name);
const find = (formations, name) => formations.find(f => f.name === name);

// ── 三方四正 helper ───────────────────────────────────────
test('trineBranchesOf 子 → 申子辰 + 對宮午', () => {
  assert.deepEqual(new Set(trineBranchesOf('子')), new Set(['申', '子', '辰', '午']));
});
test('trineBranchesOf 寅 → 寅午戌 + 對宮申', () => {
  assert.deepEqual(new Set(trineBranchesOf('寅')), new Set(['寅', '午', '戌', '申']));
});
test('isAdjBranch 環繞（子↔亥）與相鄰', () => {
  assert.equal(isAdjBranch('子', '亥'), true);
  assert.equal(isAdjBranch('戌', '酉'), true);
  assert.equal(isAdjBranch('子', '午'), false);
});

// ① 命宮空宮借星格
test('① 命宮空宮借星格', () => {
  const palaces = [P('命宮', '寅', { isEmpty: true, borrowedFromPalace: '遷移', borrowedStars: ['天機', '太陰'] })];
  const r = detectClassicalFormations(palaces, null, null, []);
  const f = find(r, '命宮空宮借星格');
  assert.ok(f, '應偵測到命宮空宮借星格');
  assert.equal(f.type, 'neutral');
  assert.equal(f.confidence, 88);
  assert.deepEqual(f.stars, ['天機（借）', '太陰（借）']);
});

// ② 身宮星組格（三變體）
test('② 身宮 天機太陰 → 天機太陰守身宮格', () => {
  const palaces = [P('遷移', '申', { major: [s('天機'), s('太陰')] })];
  const r = detectClassicalFormations(palaces, '遷移', null, []);
  assert.ok(find(r, '天機太陰守身宮格'));
});
test('② 身宮 紫微 → 紫微守身格', () => {
  const palaces = [P('官祿', '午', { major: [s('紫微')] })];
  const r = detectClassicalFormations(palaces, '官祿', null, []);
  assert.ok(find(r, '紫微守身格'));
});
test('② 身宮 武曲天府 → 武府守身格', () => {
  const palaces = [P('財帛', '子', { major: [s('武曲'), s('天府')] })];
  const r = detectClassicalFormations(palaces, '財帛', null, []);
  assert.ok(find(r, '武府守身格'));
});

// ③ 文星群聚格
test('③ 文昌文曲同宮 → 文星群聚格，confidence 85', () => {
  const palaces = [P('命宮', '丑', { minor: [s('文昌'), s('文曲')] })];
  const r = detectClassicalFormations(palaces, null, null, []);
  const f = find(r, '文星群聚命宮格');
  assert.ok(f);
  assert.equal(f.confidence, 85); // 75 + 2*5
});
test('③ 來因宮文星群聚 +5', () => {
  const palaces = [P('交友', '未', { minor: [s('左輔'), s('右弼')] })];
  const r = detectClassicalFormations(palaces, null, '交友', []);
  const f = find(r, '文星群聚交友格');
  assert.ok(f);
  assert.equal(f.confidence, 90); // 75 + 2*5 + 5(來因)
});

// ④ 財宮化忌格
test('④ 財宮巨門化忌陷 → confidence 92', () => {
  const palaces = [P('財帛', '戌', { major: [s('巨門', { brightness: '陷', yearMutagen: '化忌' })] })];
  const r = detectClassicalFormations(palaces, null, null, []);
  const f = find(r, '財宮巨門化忌陷格');
  assert.ok(f);
  assert.equal(f.type, 'challenge');
  assert.equal(f.confidence, 92);
});
test('④ 財宮化忌不陷 → confidence 80，名稱無「陷」', () => {
  const palaces = [P('財帛', '子', { major: [s('太陰', { brightness: '旺', yearMutagen: '化忌' })] })];
  const r = detectClassicalFormations(palaces, null, null, []);
  const f = find(r, '財宮太陰化忌格');
  assert.ok(f);
  assert.equal(f.confidence, 80);
});

// ⑤ 紫府朝垣格
test('⑤ 命紫微 + 遷天府 → 紫府朝垣格', () => {
  const palaces = [
    P('命宮', '寅', { major: [s('紫微')] }),
    P('遷移', '申', { major: [s('天府')] }),
  ];
  const r = detectClassicalFormations(palaces, null, null, []);
  assert.ok(find(r, '紫府朝垣格'));
});

// ⑥ 羊陀夾忌格
test('⑥ 化忌宮被擎羊陀羅兩夾 → confidence 93', () => {
  const palaces = [
    P('財帛', '戌', { major: [s('巨門')] }),
    P('疾厄', '酉', { minor: [s('擎羊')] }), // 與戌相鄰
    P('子女', '亥', { minor: [s('陀羅')] }), // 與戌相鄰
  ];
  const yearMutagens = [{ type: '化忌', palace: '財帛', star: '巨門' }];
  const r = detectClassicalFormations(palaces, null, null, yearMutagens);
  const f = find(r, '羊陀夾忌格');
  assert.ok(f);
  assert.equal(f.confidence, 93);
});

// ⑦ 空劫坐命格
test('⑦ 命宮地空 → 空劫坐命格', () => {
  const palaces = [P('命宮', '寅', { major: [s('紫微')], minor: [s('地空')] })];
  const r = detectClassicalFormations(palaces, null, null, []);
  assert.ok(find(r, '空劫坐命格'));
});

// ⑧ 祿馬同宮 / 交馳格
test('⑧ 祿存天馬同宮 → 祿馬同宮格', () => {
  const palaces = [P('遷移', '申', { minor: [s('祿存'), s('天馬')] })];
  const r = detectClassicalFormations(palaces, null, null, []);
  assert.ok(find(r, '祿馬同宮格'));
});
test('⑧ 祿存命宮 + 天馬財帛 → 祿馬交馳格', () => {
  const palaces = [
    P('命宮', '寅', { minor: [s('祿存')] }),
    P('財帛', '戌', { minor: [s('天馬')] }),
  ];
  const r = detectClassicalFormations(palaces, null, null, []);
  assert.ok(find(r, '祿馬交馳格'));
});

// 排序：confidence 由高到低
test('結果依 confidence 由高到低排序', () => {
  const palaces = [
    P('命宮', '寅', { isEmpty: true, borrowedFromPalace: '遷移', borrowedStars: ['天機'] }), // 88
    P('遷移', '申', { major: [s('天機'), s('太陰')] }), // 身宮 90
  ];
  const r = detectClassicalFormations(palaces, '遷移', null, []);
  const conf = r.map(f => f.confidence);
  const sorted = [...conf].sort((a, b) => b - a);
  assert.deepEqual(conf, sorted);
  assert.ok(names(r).includes('天機太陰守身宮格'));
});
