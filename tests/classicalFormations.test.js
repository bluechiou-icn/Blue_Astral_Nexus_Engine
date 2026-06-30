// T5（Blue 2026-06-30）— 公開古典格局偵測單元測試
// 來源：Blue Library《紫微斗數格局通則》§五 標記 Public 的「成立條件 / 古典成格規範」。
// 僅以公開古籍結構條件斷言，使用 CLAUDE.md 範例參數（非真實命例，符合 Rule 3）。
// Run: node --test tests/classicalFormations.test.js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { generateChart } = require('../chart-api.js');

function formationNames(date, time, gender) {
  const d = generateChart(date, time, gender);
  assert.ok(Array.isArray(d.classicalFormations), 'classicalFormations 應為陣列');
  return d.classicalFormations.map(f => f.name);
}

test('輸出結構：每個 formation 具備 name/type/note/confidence', () => {
  const d = generateChart('2000-01-01', '06:00', '男');
  for (const f of d.classicalFormations) {
    assert.equal(typeof f.name, 'string');
    assert.ok(['auspicious', 'neutral', 'challenge'].includes(f.type), `type 非法：${f.type}`);
    assert.equal(typeof f.note, 'string');
    assert.equal(typeof f.confidence, 'number');
    assert.ok(Array.isArray(f.palaces) && Array.isArray(f.stars));
  }
});

test('殺破狼格：命坐破軍 → 三合成格', () => {
  // 2000-01-01 06:00 男 命宮為廉貞破軍 → 破軍坐命，殺破狼三合必成
  const names = formationNames('2000-01-01', '06:00', '男');
  assert.ok(names.includes('殺破狼格'), `應偵測殺破狼格，實得：${names.join('、')}`);
});

test('命宮空宮借星格：命宮無正曜 → 借對宮', () => {
  // 1990-03-15 04:00 男 命宮空宮（己丑無正曜）
  const d = generateChart('1990-03-15', '04:00', '男');
  const ming = d.palaces.find(p => p.name === '命宮');
  assert.equal(ming.isEmpty, true, '此命例命宮應為空宮');
  assert.ok(d.classicalFormations.some(f => f.name === '命宮空宮借星格'),
    '命宮空宮應偵測命宮空宮借星格');
});

test('去重：同名格局只出現一次（catalog 不與既有 8 格重覆）', () => {
  const d = generateChart('1988-02-14', '23:30', '女');
  const names = d.classicalFormations.map(f => f.name);
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  assert.deepEqual(dup, [], `不應有重覆格局：${dup.join('、')}`);
});

test('IP 邊界：note 不含心理分析 / Blue 個人詮釋字樣（Rule 5）', () => {
  // 掃多張盤，確認公開目錄 note 僅古籍/結構描述，無 Private 詮釋關鍵字
  const banned = ['榮格', '心理', 'Blue’s', 'Blue\'s', '個人詮釋', '潛能宮', '原型', '複合體'];
  const seeds = [['2000-01-01', '06:00', '男'], ['1990-03-15', '04:00', '男'],
                 ['1988-02-14', '23:30', '女'], ['1979-11-02', '09:00', '女']];
  for (const [dt, tm, g] of seeds) {
    for (const f of generateChart(dt, tm, g).classicalFormations) {
      for (const b of banned) {
        assert.ok(!f.note.includes(b), `格局「${f.name}」note 含 Private 字樣「${b}」：${f.note}`);
      }
    }
  }
});
