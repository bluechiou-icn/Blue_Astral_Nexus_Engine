// ── 格局檢測 registry（Classical Formation Detection）──────────────
// Data-driven 格局 偵測：每個格局 = { id, detect(ctx) -> match[] }。
// 新增格局＝在 FORMATIONS 加一筆 + 一個 fixture 測試，不再往單一函式堆 if。
//
// ⚠️ IP 邊界（CLAUDE.md Rule 5）：本檔只放「公開判定規則（engine math）」
//    與簡短古典 note。格局屬性／心理詮釋／Blue's 個人哲學／榮格 = 私有，
//    永不入本檔，改由 lib/_private/ owner-ext 注入。
"use strict";

const BRANCH_SEQUENCE = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

// 對宮（六沖）
const OPPOSITE_BRANCH = {
  '子':'午','午':'子','丑':'未','未':'丑','寅':'申','申':'寅',
  '卯':'酉','酉':'卯','辰':'戌','戌':'辰','巳':'亥','亥':'巳',
};

// 三合局（每組三宮互拱）
const SANHE_GROUPS = [
  ['申','子','辰'], // 水
  ['亥','卯','未'], // 木
  ['寅','午','戌'], // 火
  ['巳','酉','丑'], // 金
];

const TYPE_ORDER = ['auspicious', 'neutral', 'challenge'];

// 三方四正 = 本宮 + 兩三合宮 + 對宮（共 4 個地支）
function trineBranchesOf(branch) {
  const group = SANHE_GROUPS.find(g => g.includes(branch));
  if (!group) return [];
  const set = new Set(group);
  const opp = OPPOSITE_BRANCH[branch];
  if (opp) set.add(opp);
  return [...set];
}

function branchIdx(b) { return BRANCH_SEQUENCE.indexOf(b); }

// 地支相鄰（夾）：序差 1 或 11（子↔亥環繞）
function isAdjBranch(b1, b2) {
  const i1 = branchIdx(b1), i2 = branchIdx(b2);
  if (i1 < 0 || i2 < 0) return false;
  const d = Math.abs(i1 - i2);
  return d === 1 || d === 11;
}

// 建立傳給每個 detector 的 context（共用判斷工具 + 常用宮位 ref）
function buildContext(palaces, bodyPalName, origPalName, yearMutagens) {
  const byName = n => palaces.find(p => p.name === n) ?? null;
  const hasMaj = (pal, name) => pal?.majorStars?.some(s => s.name === name) ?? false;
  const hasMin = (pal, name) => pal?.minorStars?.some(s => s.name === name) ?? false;
  const hasStar = (pal, name) => hasMaj(pal, name) || hasMin(pal, name);
  const isSunk = b => ['陷', '不', '不利'].includes(b);

  // 三方四正：以宮名取回落在該宮三方四正內的宮位陣列
  const palacesInTrineOf = centerName => {
    const center = byName(centerName);
    if (!center?.branch) return [];
    const set = new Set(trineBranchesOf(center.branch));
    return palaces.filter(p => set.has(p.branch));
  };
  const hasStarInTrineOf = (centerName, name) =>
    palacesInTrineOf(centerName).some(p => hasStar(p, name));

  return {
    palaces, yearMutagens,
    bodyPalName, origPalName,
    byName, hasMaj, hasMin, hasStar, isSunk,
    isAdjBranch,
    palacesInTrineOf, hasStarInTrineOf,
    bodyPal: bodyPalName ? byName(bodyPalName) : null,
    origPal: origPalName ? byName(origPalName) : null,
    mingPal: byName('命宮'),
    caiBoPal: byName('財帛'),
    qianPal: byName('遷移'),
  };
}

// ── 格局清單 ──────────────────────────────────────────────
// detect(ctx) 一律回傳 match[]（0..n 筆），match = { name, type, palaces, stars, note, confidence }
const FORMATIONS = [
  // ① 命宮空宮借星格
  {
    id: 'ming_empty_borrow',
    detect(ctx) {
      const { mingPal } = ctx;
      if (!(mingPal?.isEmpty && mingPal.borrowedFromPalace)) return [];
      return [{
        name: '命宮空宮借星格',
        type: 'neutral',
        palaces: ['命宮'],
        stars: (mingPal.borrowedStars || []).map(s => s + '（借）'),
        note: '命宮空宮，人生定向取決借星宮位方向，有外地成就或飄泊特質',
        confidence: 88,
      }];
    },
  },

  // ② 身宮星組格
  {
    id: 'body_palace_combo',
    detect(ctx) {
      const { bodyPal, bodyPalName, hasMaj } = ctx;
      if (!bodyPal) return [];
      const hasJi = hasMaj(bodyPal, '天機');
      const hasYin = hasMaj(bodyPal, '太陰');
      const hasZi = hasMaj(bodyPal, '紫微');
      const hasWu = hasMaj(bodyPal, '武曲');
      const hasFu = hasMaj(bodyPal, '天府');
      if (hasJi && hasYin) {
        return [{ name: '天機太陰守身宮格', type: 'auspicious',
          palaces: [bodyPalName], stars: ['天機', '太陰'],
          note: '身宮機月同宮，智慧流動兼具，適合外向跨域、異地發展', confidence: 90 }];
      }
      if (hasZi) {
        return [{ name: '紫微守身格', type: 'auspicious',
          palaces: [bodyPalName], stars: ['紫微'],
          note: '紫微守身宮，尊貴格局，統御領導特質強', confidence: 85 }];
      }
      if (hasWu && hasFu) {
        return [{ name: '武府守身格', type: 'auspicious',
          palaces: [bodyPalName], stars: ['武曲', '天府'],
          note: '武曲天府同守身宮，財富格局，善理財積累', confidence: 83 }];
      }
      return [];
    },
  },

  // ③ 文星群聚格（≥2 顆文星同宮）
  {
    id: 'literary_cluster',
    detect(ctx) {
      const { palaces, hasStar, origPalName, bodyPalName } = ctx;
      const LIT_STARS = ['文昌', '文曲', '左輔', '右弼'];
      const out = [];
      for (const pal of palaces) {
        const found = LIT_STARS.filter(s => hasStar(pal, s));
        if (found.length < 2) continue;
        const isOrig = pal.name === origPalName;
        const isBody = pal.name === bodyPalName;
        const isMing = pal.name === '命宮';
        out.push({
          name: `文星群聚${pal.name}格`, type: 'auspicious',
          palaces: [pal.name], stars: found,
          note: `${found.join('+')}聚${pal.name}，學術文才格` +
            (isOrig ? '，來因宮貴人助力持續' : '') +
            (isBody ? '，身宮文氣加持' : '') +
            (isMing ? '，命宮文星聰慧博學' : ''),
          confidence: 75 + found.length * 5 + (isOrig ? 5 : 0),
        });
      }
      return out;
    },
  },

  // ④ 財宮化忌格
  {
    id: 'wealth_palace_ji',
    detect(ctx) {
      const { caiBoPal, isSunk } = ctx;
      if (!caiBoPal) return [];
      const out = [];
      for (const star of caiBoPal.majorStars || []) {
        if (star.yearMutagen !== '化忌') continue;
        const sunk = isSunk(star.brightness);
        out.push({
          name: `財宮${star.name}化忌${sunk ? '陷' : ''}格`,
          type: 'challenge', palaces: ['財帛'], stars: [star.name],
          note: `${star.name}${sunk ? '陷' : ''}坐財帛+生年化忌，主動財路受阻，宜轉型知識服務或被動收入`,
          confidence: sunk ? 92 : 80,
        });
      }
      return out;
    },
  },

  // ⑤ 紫府朝垣格（命遷同照）
  {
    id: 'ziwei_tianfu_chaoyuan',
    detect(ctx) {
      const { hasMaj, mingPal, qianPal } = ctx;
      if ((hasMaj(mingPal, '紫微') && hasMaj(qianPal, '天府')) ||
          (hasMaj(mingPal, '天府') && hasMaj(qianPal, '紫微'))) {
        return [{ name: '紫府朝垣格', type: 'auspicious',
          palaces: ['命宮', '遷移'], stars: ['紫微', '天府'],
          note: '紫微天府分踞命遷，尊貴格局，有統御領導之象，宜政商界發展', confidence: 90 }];
      }
      return [];
    },
  },

  // ⑥ 羊陀夾忌格
  {
    id: 'yangtuo_jia_ji',
    detect(ctx) {
      const { yearMutagens, byName, palaces, hasStar, isAdjBranch } = ctx;
      const jiM = yearMutagens?.find(m => m.type === '化忌');
      if (!jiM?.palace) return [];
      const jiPal = byName(jiM.palace);
      if (!jiPal) return [];
      const qyPal = palaces.find(p => hasStar(p, '擎羊'));
      const tlPal = palaces.find(p => hasStar(p, '陀羅'));
      const qyAdj = qyPal && isAdjBranch(jiPal.branch, qyPal.branch);
      const tlAdj = tlPal && isAdjBranch(jiPal.branch, tlPal.branch);
      if (!(qyAdj || tlAdj)) return [];
      return [{
        name: '羊陀夾忌格', type: 'challenge',
        palaces: [jiM.palace], stars: ['擎羊', '陀羅', jiM.star].filter(Boolean),
        note: '生年忌星遭羊陀夾擊，相關宮位磁場動盪，需謹慎趨避',
        confidence: (qyAdj && tlAdj) ? 93 : 76,
      }];
    },
  },

  // ⑦ 空劫坐命格
  {
    id: 'kongjie_ming',
    detect(ctx) {
      const { mingPal, hasStar } = ctx;
      if (!mingPal || mingPal.isEmpty) return [];
      const kk = ['地空', '地劫'].filter(s => hasStar(mingPal, s));
      if (!kk.length) return [];
      return [{ name: '空劫坐命格', type: 'challenge',
        palaces: ['命宮'], stars: kk,
        note: '空劫坐命，破耗格，思路易走偏鋒，財務變動大，宜修心養性', confidence: 82 }];
    },
  },

  // ⑧ 祿馬同宮 / 交馳格
  {
    id: 'luma',
    detect(ctx) {
      const { palaces, hasStar } = ctx;
      const lucPal = palaces.find(p => hasStar(p, '祿存'));
      const maPal = palaces.find(p => hasStar(p, '天馬'));
      if (!(lucPal && maPal)) return [];
      if (lucPal.name === maPal.name) {
        return [{ name: '祿馬同宮格', type: 'auspicious',
          palaces: [lucPal.name], stars: ['祿存', '天馬'],
          note: '祿存天馬同宮，流動積財格，出外求財有利，適合跨地域事業', confidence: 88 }];
      }
      const finAxis = new Set(['命宮', '財帛', '遷移', '官祿']);
      if (finAxis.has(lucPal.name) && finAxis.has(maPal.name)) {
        return [{ name: '祿馬交馳格', type: 'auspicious',
          palaces: [lucPal.name, maPal.name], stars: ['祿存', '天馬'],
          note: '祿馬分踞財官遷命，奔波求財格，外地或異鄉發展有利', confidence: 80 }];
      }
      return [];
    },
  },
];

function runFormations(ctx) {
  const result = [];
  for (const f of FORMATIONS) {
    const matches = f.detect(ctx);
    if (matches && matches.length) result.push(...matches);
  }
  result.sort((a, b) =>
    b.confidence - a.confidence ||
    (TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type))
  );
  return result;
}

function detectClassicalFormations(palaces, bodyPalName, origPalName, yearMutagens) {
  const ctx = buildContext(palaces, bodyPalName, origPalName, yearMutagens);
  return runFormations(ctx);
}

module.exports = {
  detectClassicalFormations,
  FORMATIONS,
  buildContext,
  runFormations,
  // exposed for tests / future formations
  _internal: {
    trineBranchesOf,
    isAdjBranch,
    SANHE_GROUPS,
    OPPOSITE_BRANCH,
    BRANCH_SEQUENCE,
  },
};
