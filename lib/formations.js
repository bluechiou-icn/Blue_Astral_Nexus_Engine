// ── 格局檢測 registry（Classical Formation Detection）──────────────
// Data-driven 格局 偵測：每個格局 = { id, detect(ctx) -> match[] }。
// 新增格局＝在 FORMATIONS 加一筆 + 一個 fixture 測試。
//
// ⚠️ IP 邊界（CLAUDE.md Rule 5）：本檔只放「公開判定規則（engine math）」
//    與簡短古典 note。格局屬性／心理詮釋／Blue's 個人哲學／榮格＝私有，
//    永不入本檔，改由 lib/_private/ owner-ext 注入。
//
// Output schema：{ name, type, palaces[], stars[], note, confidence, tier }
//   - type: 'auspicious' | 'neutral' | 'challenge'   ← 方向
//   - tier: 'high' | 'mid-high' | 'mid' | 'special' | 'broken'   ← 古典貴賤
//   （原型整合度軸 → 私有層，不在本 output）
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

// 建立傳給每個 detector 的 context
function buildContext(palaces, bodyPalName, origPalName, yearMutagens) {
  const byName = n => palaces.find(p => p.name === n) ?? null;
  const hasMaj = (pal, name) => pal?.majorStars?.some(s => s.name === name) ?? false;
  const hasMin = (pal, name) => pal?.minorStars?.some(s => s.name === name) ?? false;
  const hasStar = (pal, name) => hasMaj(pal, name) || hasMin(pal, name);
  const isSunk = b => ['陷', '不', '不利'].includes(b);

  // 借星感知：空宮 + borrowedStars 命中時亦回 true
  const hasMajOrBorrowed = (pal, name) => {
    if (hasMaj(pal, name)) return true;
    if (pal?.isEmpty && Array.isArray(pal.borrowedStars) && pal.borrowedStars.includes(name)) return true;
    return false;
  };
  const hasStarOrBorrowed = (pal, name) => {
    if (hasStar(pal, name)) return true;
    if (pal?.isEmpty && Array.isArray(pal.borrowedStars) && pal.borrowedStars.includes(name)) return true;
    return false;
  };

  // 三方四正：以宮名取回落在該宮三方四正內的宮位陣列
  const palacesInTrineOf = centerName => {
    const center = byName(centerName);
    if (!center?.branch) return [];
    const set = new Set(trineBranchesOf(center.branch));
    return palaces.filter(p => set.has(p.branch));
  };
  const hasStarInTrineOf = (centerName, name) =>
    palacesInTrineOf(centerName).some(p => hasStar(p, name));
  const hasStarInTrineOfOrBorrowed = (centerName, name) =>
    palacesInTrineOf(centerName).some(p => hasStarOrBorrowed(p, name));

  return {
    palaces, yearMutagens,
    bodyPalName, origPalName,
    byName, hasMaj, hasMin, hasStar, isSunk,
    hasMajOrBorrowed, hasStarOrBorrowed,
    isAdjBranch,
    palacesInTrineOf, hasStarInTrineOf, hasStarInTrineOfOrBorrowed,
    bodyPal: bodyPalName ? byName(bodyPalName) : null,
    origPal: origPalName ? byName(origPalName) : null,
    mingPal: byName('命宮'),
    caiBoPal: byName('財帛'),
    qianPal: byName('遷移'),
  };
}

// ── 格局清單 ──────────────────────────────────────────────
const FORMATIONS = [
  // ① 命宮空宮借星格
  {
    id: 'ming_empty_borrow',
    detect(ctx) {
      const { mingPal } = ctx;
      if (!(mingPal?.isEmpty && mingPal.borrowedFromPalace)) return [];
      return [{
        name: '命宮空宮借星格',
        type: 'neutral', tier: 'special',
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
        return [{ name: '天機太陰守身宮格', type: 'auspicious', tier: 'high',
          palaces: [bodyPalName], stars: ['天機', '太陰'],
          note: '身宮機月同宮，智慧流動兼具，適合外向跨域、異地發展', confidence: 90 }];
      }
      if (hasZi) {
        return [{ name: '紫微守身格', type: 'auspicious', tier: 'high',
          palaces: [bodyPalName], stars: ['紫微'],
          note: '紫微守身宮，尊貴格局，統御領導特質強', confidence: 85 }];
      }
      if (hasWu && hasFu) {
        return [{ name: '武府守身格', type: 'auspicious', tier: 'high',
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
          name: `文星群聚${pal.name}格`, type: 'auspicious', tier: 'mid',
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
          type: 'challenge', tier: 'broken',
          palaces: ['財帛'], stars: [star.name],
          note: `${star.name}${sunk ? '陷' : ''}坐財帛+生年化忌，主動財路受阻，宜轉型知識服務或被動收入`,
          confidence: sunk ? 92 : 80,
        });
      }
      return out;
    },
  },

  // ⑤ 紫府同宮格（紫微 + 天府 同坐命宮）
  {
    id: 'zifu_tonggong',
    detect(ctx) {
      const { mingPal, hasMaj } = ctx;
      if (!(hasMaj(mingPal, '紫微') && hasMaj(mingPal, '天府'))) return [];
      return [{
        name: '紫府同宮格', type: 'auspicious', tier: 'high',
        palaces: ['命宮'], stars: ['紫微', '天府'],
        note: '紫微天府同宮入命（寅或申），尊貴穩重、福壽隆昌；忌空劫煞會（美玉瑕玷）',
        confidence: 92,
      }];
    },
  },

  // ⑥ 紫府朝垣格（紫微、天府分坐 命三方四正，且不同宮）
  // UPGRADE: 由「命+遷對宮」升級為「命三方四正合照」（涵蓋古典 4 個 sub-case）
  {
    id: 'zifu_chaoyuan',
    detect(ctx) {
      const { mingPal, hasMaj, hasStarInTrineOf } = ctx;
      // 已成紫府同宮 → 由 zifu_tonggong 報告，本格不重複
      if (hasMaj(mingPal, '紫微') && hasMaj(mingPal, '天府')) return [];
      if (hasStarInTrineOf('命宮', '紫微') && hasStarInTrineOf('命宮', '天府')) {
        return [{
          name: '紫府朝垣格', type: 'auspicious', tier: 'high',
          palaces: ['命宮'], stars: ['紫微', '天府'],
          note: '紫微天府於命三方四正合照命垣，財官雙美「食祿萬鍾」',
          confidence: 88,
        }];
      }
      return [];
    },
  },

  // ⑦ 君臣慶會格（命紫微 + 三方會 左右魁鉞 至少 3 顆）
  {
    id: 'junchen_qinghui',
    detect(ctx) {
      const { mingPal, hasMaj, palacesInTrineOf, hasStar } = ctx;
      if (!hasMaj(mingPal, '紫微')) return [];
      const FOUR_AUSP = ['左輔', '右弼', '天魁', '天鉞'];
      const trinePalaces = palacesInTrineOf('命宮');
      const seen = [];
      for (const star of FOUR_AUSP) {
        if (trinePalaces.some(p => hasStar(p, star))) seen.push(star);
      }
      if (seen.length < 3) return [];
      return [{
        name: '君臣慶會格', type: 'auspicious', tier: 'high',
        palaces: ['命宮'], stars: ['紫微', ...seen],
        note: `命紫微會三方四正${seen.join('+')}（${seen.length}/4 吉星），帝得賢臣、社會資本厚`,
        confidence: seen.length === 4 ? 92 : 86,
      }];
    },
  },

  // ⑧ 機月同梁格（命寅/申主星為 機月 或 同梁，四星齊在命三方四正）
  {
    id: 'jiyue_tongliang',
    detect(ctx) {
      const { mingPal, hasMajOrBorrowed, palacesInTrineOf, hasStarOrBorrowed } = ctx;
      if (!mingPal) return [];
      if (!['寅', '申'].includes(mingPal.branch)) return [];
      const condTongLiang = hasMajOrBorrowed(mingPal, '天同') && hasMajOrBorrowed(mingPal, '天梁');
      const condJiYin = hasMajOrBorrowed(mingPal, '天機') && hasMajOrBorrowed(mingPal, '太陰');
      if (!(condTongLiang || condJiYin)) return [];
      const trine = palacesInTrineOf('命宮');
      const fourStars = ['天機', '太陰', '天同', '天梁'];
      const allFour = fourStars.every(s => trine.some(p => hasStarOrBorrowed(p, s)));
      if (!allFour) return [];
      return [{
        name: '機月同梁格', type: 'auspicious', tier: 'mid',
        palaces: ['命宮'], stars: fourStars,
        note: '機月同梁四星於命三方四正交會，「作吏人」之格，宜公職／企業幕僚／管理服務',
        confidence: 86,
      }];
    },
  },

  // ⑨ 殺破狼格（七殺於命三方四正 → 必含破狼，三星永遠三合）
  {
    id: 'sha_po_lang',
    detect(ctx) {
      const { palacesInTrineOf, hasStar } = ctx;
      const trine = palacesInTrineOf('命宮');
      if (!trine.length) return [];
      if (!trine.some(p => hasStar(p, '七殺'))) return [];
      return [{
        name: '殺破狼格', type: 'neutral', tier: 'mid',
        palaces: ['命宮'], stars: ['七殺', '破軍', '貪狼'],
        note: '七殺破軍貪狼三方會命，動盪變局之格、「先破後立」；論吉凶須看會吉煞與廟陷',
        confidence: 75,
      }];
    },
  },

  // ⑩ 火貪格（貪狼 + 火星 同宮）
  {
    id: 'huo_tan',
    detect(ctx) {
      const { palaces, hasMaj, hasStar } = ctx;
      const out = [];
      for (const pal of palaces) {
        if (hasMaj(pal, '貪狼') && hasStar(pal, '火星')) {
          out.push({
            name: '火貪格', type: 'auspicious', tier: 'mid-high',
            palaces: [pal.name], stars: ['貪狼', '火星'],
            note: '貪狼與火星同宮，暴發格，物質金錢爆發力強；忌會羊陀（色災成禍）',
            confidence: 84,
          });
        }
      }
      return out;
    },
  },

  // ⑪ 鈴貪格（貪狼 + 鈴星 同宮）
  {
    id: 'ling_tan',
    detect(ctx) {
      const { palaces, hasMaj, hasStar } = ctx;
      const out = [];
      for (const pal of palaces) {
        if (hasMaj(pal, '貪狼') && hasStar(pal, '鈴星')) {
          out.push({
            name: '鈴貪格', type: 'auspicious', tier: 'mid-high',
            palaces: [pal.name], stars: ['貪狼', '鈴星'],
            note: '貪狼與鈴星同宮，暴發格（較內斂、重後勁），先名後利；忌會羊陀',
            confidence: 82,
          });
        }
      }
      return out;
    },
  },

  // ⑫ 三奇嘉會格（化祿/化權/化科 三宮皆 ∈ 命三方四正）
  //   ※ 本檔僅實作公開「傳統命宮版」；命空宮以身宮三方主軸判格＝Blue 私有規則（不在此處）
  {
    id: 'sanqi_jiahui',
    detect(ctx) {
      const { yearMutagens, palacesInTrineOf } = ctx;
      if (!yearMutagens?.length) return [];
      const lu = yearMutagens.find(m => m.type === '化祿')?.palace;
      const quan = yearMutagens.find(m => m.type === '化權')?.palace;
      const ke = yearMutagens.find(m => m.type === '化科')?.palace;
      if (!(lu && quan && ke)) return [];
      const trine = new Set(palacesInTrineOf('命宮').map(p => p.name));
      if (!(trine.has(lu) && trine.has(quan) && trine.has(ke))) return [];
      return [{
        name: '三奇嘉會格', type: 'auspicious', tier: 'high',
        palaces: ['命宮'], stars: ['化祿', '化權', '化科'],
        note: '化祿化權化科三吉化會命三方四正，「定為折桂之高人」；後天努力承接尤關鍵',
        confidence: 90,
      }];
    },
  },

  // ⑬ 陽梁昌祿格（太陽/天梁/文昌/祿存(或化祿) 四星皆 ∈ 命三方四正）
  {
    id: 'yang_liang_chang_lu',
    detect(ctx) {
      const { palacesInTrineOf, hasStar, yearMutagens } = ctx;
      const trine = palacesInTrineOf('命宮');
      if (!trine.length) return [];
      const inTrine = name => trine.some(p => hasStar(p, name));
      const hasSun = inTrine('太陽');
      const hasLiang = inTrine('天梁');
      const hasChang = inTrine('文昌');
      const hasLuExist = inTrine('祿存');
      const huaLuPal = yearMutagens?.find(m => m.type === '化祿')?.palace;
      const hasHuaLu = !!(huaLuPal && trine.some(p => p.name === huaLuPal));
      if (!(hasSun && hasLiang && hasChang && (hasLuExist || hasHuaLu))) return [];
      return [{
        name: '陽梁昌祿格', type: 'auspicious', tier: 'high',
        palaces: ['命宮'], stars: ['太陽', '天梁', '文昌', hasLuExist ? '祿存' : '化祿'],
        note: '太陽天梁文昌祿（存或化祿）會命三方四正，科甲之格，宜考試／學術／公職／專業聲望',
        confidence: 89,
      }];
    },
  },

  // ⑭ 羊陀夾忌格
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
        name: '羊陀夾忌格', type: 'challenge', tier: 'broken',
        palaces: [jiM.palace], stars: ['擎羊', '陀羅', jiM.star].filter(Boolean),
        note: '生年忌星遭羊陀夾擊，相關宮位磁場動盪、需謹慎趨避（高壓期提醒，非宿命）',
        confidence: (qyAdj && tlAdj) ? 93 : 76,
      }];
    },
  },

  // ⑮ 空劫坐命格
  {
    id: 'kongjie_ming',
    detect(ctx) {
      const { mingPal, hasStar } = ctx;
      if (!mingPal || mingPal.isEmpty) return [];
      const kk = ['地空', '地劫'].filter(s => hasStar(mingPal, s));
      if (!kk.length) return [];
      return [{
        name: '空劫坐命格', type: 'challenge', tier: 'special',
        palaces: ['命宮'], stars: kk,
        note: '空劫坐命，傳統判破耗；當代詮釋為靈性／知識傳遞之管道格，宜修心轉化',
        confidence: 82,
      }];
    },
  },

  // ⑯ 祿馬同宮 / 交馳格
  {
    id: 'luma',
    detect(ctx) {
      const { palaces, hasStar } = ctx;
      const lucPal = palaces.find(p => hasStar(p, '祿存'));
      const maPal = palaces.find(p => hasStar(p, '天馬'));
      if (!(lucPal && maPal)) return [];
      if (lucPal.name === maPal.name) {
        return [{
          name: '祿馬同宮格', type: 'auspicious', tier: 'mid-high',
          palaces: [lucPal.name], stars: ['祿存', '天馬'],
          note: '祿存天馬同宮，流動積財格，出外求財有利，適合跨地域事業',
          confidence: 88,
        }];
      }
      const finAxis = new Set(['命宮', '財帛', '遷移', '官祿']);
      if (finAxis.has(lucPal.name) && finAxis.has(maPal.name)) {
        return [{
          name: '祿馬交馳格', type: 'auspicious', tier: 'mid-high',
          palaces: [lucPal.name, maPal.name], stars: ['祿存', '天馬'],
          note: '祿馬分踞財官遷命，奔波求財格，外地或異鄉發展有利',
          confidence: 80,
        }];
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
  _internal: {
    trineBranchesOf,
    isAdjBranch,
    SANHE_GROUPS,
    OPPOSITE_BRANCH,
    BRANCH_SEQUENCE,
  },
};
