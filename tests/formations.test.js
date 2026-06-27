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
  assert.equal(f.tier, 'special');
  assert.equal(f.confidence, 88);
  assert.deepEqual(f.stars, ['天機（借）', '太陰（借）']);
});

// ② 身宮星組格
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

// ③ 文星群聚
test('③ 文昌文曲同宮 → 文星群聚格，confidence 85', () => {
  const palaces = [P('命宮', '丑', { minor: [s('文昌'), s('文曲')] })];
  const r = detectClassicalFormations(palaces, null, null, []);
  const f = find(r, '文星群聚命宮格');
  assert.ok(f);
  assert.equal(f.tier, 'mid');
  assert.equal(f.confidence, 85);
});
test('③ 來因宮文星群聚 +5', () => {
  const palaces = [P('交友', '未', { minor: [s('左輔'), s('右弼')] })];
  const r = detectClassicalFormations(palaces, null, '交友', []);
  const f = find(r, '文星群聚交友格');
  assert.ok(f);
  assert.equal(f.confidence, 90);
});

// ④ 財宮化忌格
test('④ 財宮巨門化忌陷 → confidence 92', () => {
  const palaces = [P('財帛', '戌', { major: [s('巨門', { brightness: '陷', yearMutagen: '化忌' })] })];
  const r = detectClassicalFormations(palaces, null, null, []);
  const f = find(r, '財宮巨門化忌陷格');
  assert.ok(f);
  assert.equal(f.type, 'challenge');
  assert.equal(f.tier, 'broken');
  assert.equal(f.confidence, 92);
});
test('④ 財宮化忌不陷 → confidence 80，名稱無「陷」', () => {
  const palaces = [P('財帛', '子', { major: [s('太陰', { brightness: '旺', yearMutagen: '化忌' })] })];
  const r = detectClassicalFormations(palaces, null, null, []);
  const f = find(r, '財宮太陰化忌格');
  assert.ok(f);
  assert.equal(f.confidence, 80);
});

// ⑤ 紫府同宮格（新）
test('⑤ 紫微+天府同坐命寅 → 紫府同宮格，不同時報朝垣', () => {
  const palaces = [P('命宮', '寅', { major: [s('紫微'), s('天府')] })];
  const r = detectClassicalFormations(palaces, null, null, []);
  assert.ok(find(r, '紫府同宮格'));
  assert.equal(find(r, '紫府朝垣格'), undefined, '同宮已成則不重複報朝垣');
});

// ⑥ 紫府朝垣格（upgrade：三方四正版）
test('⑥ 紫微命寅 + 天府遷申 → 紫府朝垣格', () => {
  const palaces = [
    P('命宮', '寅', { major: [s('紫微')] }),
    P('遷移', '申', { major: [s('天府')] }),
  ];
  const r = detectClassicalFormations(palaces, null, null, []);
  assert.ok(find(r, '紫府朝垣格'));
});
test('⑥ 紫微命寅 + 天府官午（三合） → 紫府朝垣格', () => {
  const palaces = [
    P('命宮', '寅', { major: [s('紫微')] }),
    P('官祿', '午', { major: [s('天府')] }),
  ];
  const r = detectClassicalFormations(palaces, null, null, []);
  assert.ok(find(r, '紫府朝垣格'));
});
test('⑥ 紫微 / 天府 不在命三方四正 → 不成', () => {
  const palaces = [
    P('命宮', '寅', { major: [s('天機')] }),
    P('父母', '卯', { major: [s('紫微')] }),
    P('兄弟', '丑', { major: [s('天府')] }),
  ];
  const r = detectClassicalFormations(palaces, null, null, []);
  assert.equal(find(r, '紫府朝垣格'), undefined);
});

// ⑦ 君臣慶會格（新）
test('⑦ 命紫微 + 三方四正會 4 顆吉星 → 君臣慶會 confidence 92', () => {
  const palaces = [
    P('命宮', '寅', { major: [s('紫微')] }),
    P('官祿', '午', { minor: [s('左輔'), s('右弼')] }),
    P('財帛', '戌', { minor: [s('天魁')] }),
    P('遷移', '申', { minor: [s('天鉞')] }),
  ];
  const r = detectClassicalFormations(palaces, null, null, []);
  const f = find(r, '君臣慶會格');
  assert.ok(f);
  assert.equal(f.confidence, 92);
});
test('⑦ 命紫微 + 三方僅 2 吉 → 不成（門檻 3）', () => {
  const palaces = [
    P('命宮', '寅', { major: [s('紫微')] }),
    P('官祿', '午', { minor: [s('左輔')] }),
    P('遷移', '申', { minor: [s('天魁')] }),
  ];
  const r = detectClassicalFormations(palaces, null, null, []);
  assert.equal(find(r, '君臣慶會格'), undefined);
});

// ⑧ 機月同梁格（新，需含借星感知）
test('⑧ 命同梁在寅 + 三方含機月同梁四星 → 機月同梁格', () => {
  // 命寅 天同+天梁；三方 寅(同梁) 午(機) 戌(陰) 申(對宮)
  const palaces = [
    P('命宮', '寅', { major: [s('天同'), s('天梁')] }),
    P('官祿', '午', { major: [s('天機')] }),
    P('財帛', '戌', { major: [s('太陰')] }),
    P('遷移', '申', { major: [s('巨門')] }),
  ];
  const r = detectClassicalFormations(palaces, null, null, []);
  assert.ok(find(r, '機月同梁格'));
});
test('⑧ 命寅借機月（空宮）+ 三方四星齊 → 仍應成格', () => {
  // 模擬命空借遷申(機陰)；三方含 同(辰?) → 用 戌(同) + 午(梁) 替代為三方
  // 命寅 三方四正＝寅午戌申
  const palaces = [
    P('命宮', '寅', { isEmpty: true, borrowedFromPalace: '遷移', borrowedStars: ['天機', '太陰'] }),
    P('官祿', '午', { major: [s('天梁')] }),
    P('財帛', '戌', { major: [s('天同')] }),
    P('遷移', '申', { major: [s('天機'), s('太陰')] }),
  ];
  const r = detectClassicalFormations(palaces, '遷移', null, []);
  assert.ok(find(r, '機月同梁格'), '借星感知應使此格成立');
});
test('⑧ 命非寅申 → 不成', () => {
  const palaces = [
    P('命宮', '子', { major: [s('天同'), s('天梁')] }),
    P('夫妻', '戌', { major: [s('天機'), s('太陰')] }),
  ];
  const r = detectClassicalFormations(palaces, null, null, []);
  assert.equal(find(r, '機月同梁格'), undefined);
});

// ⑨ 殺破狼格（新）
test('⑨ 七殺在命三方四正 → 殺破狼格 fires', () => {
  const palaces = [
    P('命宮', '寅', { major: [s('紫微')] }),
    P('遷移', '申', { major: [s('七殺')] }),
  ];
  const r = detectClassicalFormations(palaces, null, null, []);
  const f = find(r, '殺破狼格');
  assert.ok(f);
  assert.equal(f.type, 'neutral');
  assert.equal(f.confidence, 75);
});
test('⑨ 七殺不在命三方四正 → 不成', () => {
  const palaces = [
    P('命宮', '寅', { major: [s('紫微')] }),
    P('兄弟', '丑', { major: [s('七殺')] }),
  ];
  const r = detectClassicalFormations(palaces, null, null, []);
  assert.equal(find(r, '殺破狼格'), undefined);
});

// ⑩ 火貪格（新）
test('⑩ 貪狼 + 火星同宮 → 火貪格', () => {
  const palaces = [P('財帛', '辰', { major: [s('貪狼')], minor: [s('火星')] })];
  const r = detectClassicalFormations(palaces, null, null, []);
  const f = find(r, '火貪格');
  assert.ok(f);
  assert.equal(f.confidence, 84);
  assert.equal(f.tier, 'mid-high');
});

// ⑪ 鈴貪格（新）
test('⑪ 貪狼 + 鈴星同宮 → 鈴貪格', () => {
  const palaces = [P('官祿', '戌', { major: [s('貪狼')], minor: [s('鈴星')] })];
  const r = detectClassicalFormations(palaces, null, null, []);
  assert.ok(find(r, '鈴貪格'));
});

// ⑫ 三奇嘉會格（新，傳統命三方版）
test('⑫ 化祿/權/科 三宮皆在命三方四正 → 三奇嘉會', () => {
  // 命寅 三方四正 寅午戌申
  const palaces = [
    P('命宮', '寅'),
    P('官祿', '午'),
    P('財帛', '戌'),
    P('遷移', '申'),
  ];
  const yearMutagens = [
    { type: '化祿', palace: '官祿', star: '武曲' },
    { type: '化權', palace: '財帛', star: '貪狼' },
    { type: '化科', palace: '遷移', star: '天梁' },
    { type: '化忌', palace: '夫妻', star: '文曲' },
  ];
  const r = detectClassicalFormations(palaces, null, null, yearMutagens);
  const f = find(r, '三奇嘉會格');
  assert.ok(f);
  assert.equal(f.confidence, 90);
});
test('⑫ 化權在命三方外 → 不成（傳統嚴格版）', () => {
  // 模擬 Blue 本命局：化權落福德辰（不在命寅三方四正）
  const palaces = [
    P('命宮', '寅'),
    P('福德', '辰'),
    P('遷移', '申'),
  ];
  const yearMutagens = [
    { type: '化祿', palace: '遷移', star: '太陰' },
    { type: '化權', palace: '福德', star: '天同' }, // 不在命三方
    { type: '化科', palace: '遷移', star: '天機' },
  ];
  const r = detectClassicalFormations(palaces, null, null, yearMutagens);
  assert.equal(find(r, '三奇嘉會格'), undefined,
    '此即驗證：Blue 本命的「身宮主軸版」需另由私有 IP 規則判斷');
});

// ⑬ 陽梁昌祿格（新）
test('⑬ 太陽天梁文昌祿存皆在命三方四正 → 陽梁昌祿', () => {
  // 命卯 三方四正 卯亥未酉
  const palaces = [
    P('命宮', '卯', { major: [s('太陽'), s('天梁')], minor: [s('文昌'), s('祿存')] }),
  ];
  const r = detectClassicalFormations(palaces, null, null, []);
  assert.ok(find(r, '陽梁昌祿格'));
});
test('⑬ 用化祿替代祿存亦成', () => {
  const palaces = [
    P('命宮', '卯', { major: [s('太陽'), s('天梁')], minor: [s('文昌')] }),
  ];
  const yearMutagens = [{ type: '化祿', palace: '命宮', star: '太陽' }];
  const r = detectClassicalFormations(palaces, null, null, yearMutagens);
  assert.ok(find(r, '陽梁昌祿格'));
});

// ⑭ 羊陀夾忌格
test('⑭ 化忌宮被擎羊陀羅兩夾 → confidence 93', () => {
  const palaces = [
    P('財帛', '戌', { major: [s('巨門')] }),
    P('疾厄', '酉', { minor: [s('擎羊')] }),
    P('子女', '亥', { minor: [s('陀羅')] }),
  ];
  const yearMutagens = [{ type: '化忌', palace: '財帛', star: '巨門' }];
  const r = detectClassicalFormations(palaces, null, null, yearMutagens);
  const f = find(r, '羊陀夾忌格');
  assert.ok(f);
  assert.equal(f.confidence, 93);
});

// ⑮ 空劫坐命格
test('⑮ 命宮地空 → 空劫坐命格', () => {
  const palaces = [P('命宮', '寅', { major: [s('紫微')], minor: [s('地空')] })];
  const r = detectClassicalFormations(palaces, null, null, []);
  const f = find(r, '空劫坐命格');
  assert.ok(f);
  assert.equal(f.tier, 'special');
});

// ⑯ 祿馬同宮 / 交馳
test('⑯ 祿存天馬同宮 → 祿馬同宮格', () => {
  const palaces = [P('遷移', '申', { minor: [s('祿存'), s('天馬')] })];
  const r = detectClassicalFormations(palaces, null, null, []);
  assert.ok(find(r, '祿馬同宮格'));
});
test('⑯ 祿存命宮 + 天馬財帛 → 祿馬交馳格', () => {
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
    P('命宮', '寅', { isEmpty: true, borrowedFromPalace: '遷移', borrowedStars: ['天機'] }),
    P('遷移', '申', { major: [s('天機'), s('太陰')] }),
  ];
  const r = detectClassicalFormations(palaces, '遷移', null, []);
  const conf = r.map(f => f.confidence);
  const sorted = [...conf].sort((a, b) => b - a);
  assert.deepEqual(conf, sorted);
});

// 全格局 tier 完備
test('所有命中格局都有 tier 欄位', () => {
  const palaces = [
    P('命宮', '寅', { major: [s('紫微'), s('天府')] }),
  ];
  const r = detectClassicalFormations(palaces, null, null, []);
  assert.ok(r.length > 0);
  for (const f of r) assert.ok(f.tier, `${f.name} 缺 tier`);
});
