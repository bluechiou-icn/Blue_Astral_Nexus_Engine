"use strict";

const pkg = require("iztro");
const { astro, util } = pkg;
const { timeToIndex, SHICHEN_NAMES } = require("./utils.js");

astro.config({ language: "zh-TW" });

const MUTAGEN_KEYS  = ["祿", "權", "科", "忌"];
const MUTAGEN_FULL  = ["化祿", "化權", "化科", "化忌"];

// ── 修改一：宮位名稱現代化 ───────────────────────────────────
const PALACE_MODERN_NAMES = {
  "僕役": "交友",
  "仆役": "交友",   // 簡體變體
};

function modernizePalaceName(name) {
  return PALACE_MODERN_NAMES[name] ?? name;
}

// ── 簡繁對照表 ────────────────────────────────────────────────
const SIMP_TO_TRAD = {
  '阴': '陰', '阳': '陽',
  '机': '機', '贞': '貞', '贪': '貪', '门': '門',
  '杀': '殺', '军': '軍', '禄': '祿', '仆': '僕',
  '迁': '遷', '财': '財', '宫': '宮',
  '权': '權', '贵': '貴', '诰': '誥', '厨': '廚',
  '马': '馬', '罗': '羅', '辅': '輔',
  '龙': '龍', '凤': '鳳', '阁': '閣',
  '华': '華', '盖': '蓋', '伤': '傷', '虚': '虛',
  '钺': '鉞', '铃': '鈴', '红': '紅', '鸾': '鸞',
  '寿': '壽', '庙': '廟', '气': '氣', '苍': '蒼',
  '运': '運',
  // 長生十二神 / 博士 / 將前 / 歲前 系統
  '绝': '絕', '长': '長', '临': '臨',
  '将': '將', '书': '書', '飞': '飛',
  '岁': '歲', '驿': '驛', '灾': '災',
  '丧': '喪', '贯': '貫', '带': '帶', '养': '養',
};

function toTrad(str) {
  if (typeof str !== "string") return str;
  return str.replace(
    /[阴阳机贞贪门杀军禄仆迁财宫权贵诰厨马罗辅龙凤阁华盖伤虚钺铃红鸾寿庙气苍运绝长临将书飞岁驿灾丧贯带养]/g,
    ch => SIMP_TO_TRAD[ch] ?? ch
  );
}

function deepToTrad(val) {
  if (typeof val === "string") return modernizePalaceName(toTrad(val));
  if (Array.isArray(val))     return val.map(deepToTrad);
  if (val && typeof val === "object")
    return Object.fromEntries(Object.entries(val).map(([k, v]) => [k, deepToTrad(v)]));
  return val;
}

// ── 主星 Metadata ────────────────────────────────────────────
const STAR_META = {
  '紫微': { element: '土', nature: '中性偏吉', keywords: '尊貴·領導·孤高' },
  '天機': { element: '木', nature: '吉星',     keywords: '智慧·機變·善良' },
  '太陽': { element: '火', nature: '吉星',     keywords: '光明·博愛·陽剛' },
  '武曲': { element: '金', nature: '中性',     keywords: '財富·剛毅·果斷' },
  '天同': { element: '水', nature: '吉星',     keywords: '溫和·享福·隨緣' },
  '廉貞': { element: '火', nature: '凶中帶吉', keywords: '才藝·刑囚·桃花' },
  '天府': { element: '土', nature: '吉星',     keywords: '財庫·穩重·保守' },
  '太陰': { element: '水', nature: '吉星',     keywords: '柔美·財富·陰柔' },
  '貪狼': { element: '木', nature: '中性',     keywords: '欲望·桃花·多才' },
  '巨門': { element: '水', nature: '凶中帶吉', keywords: '口舌·是非·善辯' },
  '天相': { element: '水', nature: '吉星',     keywords: '輔佐·行政·印綬' },
  '天梁': { element: '土', nature: '吉星',     keywords: '蔭護·醫藥·長輩' },
  '七殺': { element: '金', nature: '凶星',     keywords: '將星·果決·孤克' },
  '破軍': { element: '水', nature: '凶星',     keywords: '開創·變動·破壞' },
};

// ── 八等級亮度排名（Blue's Version） ─────────────────────────
const BRIGHTNESS_RANK = {
  '廟':   1,
  '旺':   2,
  '得':   3,
  '利':   4,
  '平':   5,
  '不利': 6,
  '陷':   7,
  '不':   8,
};

// ── 輔星安置對照表（Blue's Version）────────────────────────────

const TIANKUI_POSITIONS = {
  '甲':'丑','乙':'子','丙':'亥','丁':'亥',
  '戊':'丑','己':'子','庚':'丑','辛':'午',
  '壬':'卯','癸':'卯'
};
const TIANYUE_POSITIONS = {
  '甲':'未','乙':'申','丙':'酉','丁':'酉',
  '戊':'未','己':'申','庚':'未','辛':'寅',
  '壬':'巳','癸':'巳'
};
const LUCUN_POSITIONS = {
  '甲':'寅','乙':'卯','丙':'巳','丁':'午',
  '戊':'巳','己':'午','庚':'申','辛':'酉',
  '壬':'亥','癸':'子'
};
const TIANMA_RULES = {
  '寅':'申','午':'申','戌':'申',
  '申':'寅','子':'寅','辰':'寅',
  '巳':'亥','酉':'亥','丑':'亥',
  '亥':'巳','卯':'巳','未':'巳'
};
const ZUOFU_POSITIONS = {
  '寅':'辰','卯':'巳','辰':'午','巳':'未',
  '午':'申','未':'酉','申':'戌','酉':'亥',
  '戌':'子','亥':'丑','子':'寅','丑':'卯'
};
const YOUBI_POSITIONS = {
  '寅':'戌','卯':'酉','辰':'申','巳':'未',
  '午':'午','未':'巳','申':'辰','酉':'卯',
  '戌':'寅','亥':'丑','子':'子','丑':'亥'
};
const DIKONG_POSITIONS = {
  '子':'亥','丑':'子','寅':'丑','卯':'寅',
  '辰':'卯','巳':'辰','午':'巳','未':'午',
  '申':'未','酉':'申','戌':'酉','亥':'戌'
};
const DIJIE_POSITIONS = {
  '子':'子','丑':'亥','寅':'戌','卯':'酉',
  '辰':'申','巳':'未','午':'午','未':'巳',
  '申':'辰','酉':'卯','戌':'寅','亥':'丑'
};
const TIME_INDEX_TO_BRANCH = [
  '子','丑','寅','卯','辰','巳',
  '午','未','申','酉','戌','亥','子'
];

// ── 星名分類 ─────────────────────────────────────────────────
const STAR_CATEGORY = {
  // 四煞
  '擎羊':'四煞', '陀羅':'四煞', '火星':'四煞', '鈴星':'四煞',
  // 空劫
  '地空':'空劫', '地劫':'空劫',
  // 輔弼
  '左輔':'輔弼', '右弼':'輔弼',
  // 文星
  '文昌':'文星', '文曲':'文星',
  // 貴人
  '天魁':'貴人', '天鉞':'貴人',
  // 特殊
  '天馬':'天馬', '祿存':'祿存',
};
function starCategory(name) {
  return STAR_CATEGORY[name] ?? '雜曜';
}

// ── 對宮地支對照 ─────────────────────────────────────────────
const OPPOSITE_BRANCH = {
  '子':'午', '午':'子',
  '丑':'未', '未':'丑',
  '寅':'申', '申':'寅',
  '卯':'酉', '酉':'卯',
  '辰':'戌', '戌':'辰',
  '巳':'亥', '亥':'巳',
};

// ── Blue's Version 四化對照表（ÆTHNOUS 唯一採用版本） ────────
// 庚干：天同科 / 天相忌（iztro 原版太陰科/天同忌有誤，已修正）
const BLUE_SI_HUA_TABLE = {
  '甲': ['廉貞', '破軍', '武曲', '太陽'],
  '乙': ['天機', '天梁', '紫微', '太陰'],
  '丙': ['天同', '天機', '文昌', '廉貞'],
  '丁': ['太陰', '天同', '天機', '巨門'],
  '戊': ['貪狼', '太陰', '右弼', '天機'],
  '己': ['武曲', '貪狼', '天梁', '文曲'],
  '庚': ['太陽', '武曲', '天同', '天相'],
  '辛': ['巨門', '太陽', '文曲', '文昌'],
  '壬': ['天梁', '紫微', '左輔', '武曲'],
  '癸': ['破軍', '巨門', '太陰', '貪狼'],
};

// ── 四化相關工具 ─────────────────────────────────────────────

// 根據天干取得四化星（完全使用 BLUE_SI_HUA_TABLE，不依賴 iztro）
function getMutagenStars(stem) {
  const tradStem = toTrad(stem);
  const stars = BLUE_SI_HUA_TABLE[tradStem];
  if (!stars) return ['', '', '', ''];
  return stars;
}

// ── 輔星亮度計算（Blue's Version）────────────────────────────
function calcMinorStarBrightness(starName, palaceBranch, birthData) {
  const { yearStem, yearBranch, monthBranch, hourBranch } = birthData;
  switch (starName) {
    case '天魁': { const pos = TIANKUI_POSITIONS[yearStem];  return pos === palaceBranch ? '廟' : null; }
    case '天鉞': { const pos = TIANYUE_POSITIONS[yearStem];  return pos === palaceBranch ? '廟' : null; }
    case '祿存': { const pos = LUCUN_POSITIONS[yearStem];    return pos === palaceBranch ? '廟' : null; }
    case '天馬': { const pos = TIANMA_RULES[yearBranch];     return pos === palaceBranch ? '廟' : '平'; }
    case '左輔': { const pos = ZUOFU_POSITIONS[monthBranch]; return pos === palaceBranch ? '廟' : null; }
    case '右弼': { const pos = YOUBI_POSITIONS[monthBranch]; return pos === palaceBranch ? '廟' : null; }
    case '地空': { const pos = DIKONG_POSITIONS[hourBranch]; return pos === palaceBranch ? '廟' : '平'; }
    case '地劫': { const pos = DIJIE_POSITIONS[hourBranch];  return pos === palaceBranch ? '廟' : '平'; }
    default: return null;
  }
}

// 在宮位陣列中找某顆星所在的宮位
function findStarPalace(rawPalaces, starName) {
  return rawPalaces.find(p =>
    p.majorStars.some(s => toTrad(s.name) === starName) ||
    p.minorStars.some(s => toTrad(s.name) === starName)
  ) ?? null;
}

// 計算某宮位的「飛出四化」陣列
function computeOutgoing(rawPalace, rawPalaces) {
  const stem  = rawPalace.heavenlyStem;
  const stars = getMutagenStars(stem);
  const selfName = modernizePalaceName(toTrad(rawPalace.name));

  return MUTAGEN_FULL.map((type, i) => {
    const star        = stars[i];
    const targetRaw   = findStarPalace(rawPalaces, star);
    const targetName  = targetRaw
      ? modernizePalaceName(toTrad(targetRaw.name))
      : null;
    const isSelf      = targetName === selfName;
    return {
      stem,
      type,
      star,
      targetPalace: targetName,
      isSelfTransformation: isSelf,
      notation: isSelf ? `↓${type[1]}` : null,
    };
  });
}

// 計算某宮位的「飛入四化」陣列
function computeIncoming(thisPalaceName, allOutgoing) {
  const result = [];
  for (const [fromName, outList] of Object.entries(allOutgoing)) {
    if (fromName === thisPalaceName) continue;
    for (const o of outList) {
      if (o.targetPalace === thisPalaceName) {
        result.push({
          fromPalace: fromName,
          fromStem:   o.stem,
          type:       o.type,
          star:       o.star,
          notation:   `↑${o.type[1]}`,
          note:       `由${fromName}宮干${o.stem}觸發`,
        });
      }
    }
  }
  return result;
}

// ── 主函式 ───────────────────────────────────────────────────
function generateChart(solarDate, birthTime, gender) {
  const timeIndex = timeToIndex(birthTime);
  const r = astro.bySolar(solarDate, timeIndex, gender, true);

  // ── 生年干、陰陽 ──────────────────────────────────────────
  const yearStem   = r.rawDates.chineseDate.yearly[0];
  const yearBranch = r.rawDates.chineseDate.yearly[1];

  // ── 提取生辰干支供輔星亮度計算 ──
  const birthData = {
    yearStem:    toTrad(yearStem),
    yearBranch:  toTrad(yearBranch),
    monthBranch: toTrad(r.rawDates.chineseDate.monthly[1]),
    hourBranch:  toTrad(TIME_INDEX_TO_BRANCH[timeIndex]),
  };
  const yangStems = ["甲", "丙", "戊", "庚", "壬"];
  const isYang    = yangStems.includes(yearStem);
  const yinYang   = (isYang ? "陽" : "陰") + gender;

  // ── 生年四化 ──────────────────────────────────────────────
  const yearMutagenStars = getMutagenStars(yearStem);
  const yearMutagens = MUTAGEN_FULL.map((type, i) => {
    const star   = yearMutagenStars[i];
    const palace = findStarPalace(r.palaces, star);
    return {
      type,
      star,
      palace:         palace ? modernizePalaceName(toTrad(palace.name)) : null,
      palaceStemBranch: palace ? palace.heavenlyStem + palace.earthlyBranch : null,
    };
  });

  // ── 預先計算所有宮位的飛出四化（用於計算飛入） ──────────────
  const allOutgoing = {};
  for (const p of r.palaces) {
    const name = modernizePalaceName(toTrad(p.name));
    allOutgoing[name] = computeOutgoing(p, r.palaces);
  }

  // ── 身宮 / 來因宮 ──────────────────────────────────────────
  const bodyPalace     = r.palaces.find(p => p.isBodyPalace);
  const originalPalace = r.palaces.find(p => p.isOriginalPalace);

  // ── 修改三：完整宮位資料 ───────────────────────────────────
  const birthYear = parseInt(solarDate.split("-")[0]);

  const palaces = r.palaces.map(p => {
    const rawName  = toTrad(p.name);
    const palName  = modernizePalaceName(rawName);
    const stem     = p.heavenlyStem;
    const branch   = p.earthlyBranch;
    const palStem  = toTrad(stem);

    // 本宮飛出四化
    const outgoing = allOutgoing[palName];
    // 飛入四化
    const incoming = computeIncoming(palName, allOutgoing);

    // 主星處理
    const majorStars = p.majorStars.map(s => {
      const sName = toTrad(s.name);
      // 生年四化
      const yearMutagenIdx = yearMutagenStars.indexOf(sName);
      const yearMutagen    = yearMutagenIdx >= 0 ? MUTAGEN_FULL[yearMutagenIdx] : null;

      // 自化：本宮干觸發此星四化且此星在本宮
      const palMutagenStars = getMutagenStars(stem);
      const selfIdx = palMutagenStars.indexOf(sName);
      const isSelf  = selfIdx >= 0;
      const selfTransformation = {
        active:    isSelf,
        type:      isSelf ? MUTAGEN_FULL[selfIdx] : null,
        notation:  isSelf ? `↓${MUTAGEN_KEYS[selfIdx]}` : null,
        sourceStem: isSelf ? palStem : null,
        note:      isSelf ? `${palStem}干觸發${sName}${MUTAGEN_FULL[selfIdx]}，星在本宮形成自化` : null,
      };

      // 飛入（其他宮干觸發此星，飛入本宮）
      const incomingToStar = incoming.filter(inc => inc.star === sName);

      const meta = STAR_META[sName] ?? null;
      const brightness = toTrad(s.brightness) || null;
      return {
        name:                sName,
        brightness,
        brightnessRank:      BRIGHTNESS_RANK[brightness] ?? null,
        yearMutagen,
        element:             meta?.element  ?? null,
        nature:              meta?.nature   ?? null,
        keywords:            meta?.keywords ?? null,
        selfTransformation,
        incomingMutations:   incomingToStar,
      };
    });

    // 借對宮（空宮借星）
    const isEmpty = majorStars.length === 0;
    const oppBranch = OPPOSITE_BRANCH[branch];
    const oppRaw = isEmpty ? r.palaces.find(q => q.earthlyBranch === oppBranch) : null;
    const borrowedFromPalace = oppRaw ? modernizePalaceName(toTrad(oppRaw.name)) : null;
    const borrowedStars = oppRaw ? oppRaw.majorStars.map(s => toTrad(s.name)) : null;

    // 輔星
    const minorStars = p.minorStars.map(s => {
      const sName       = toTrad(s.name);
      const iztroBright = toTrad(s.brightness) || null;
      const calcBright  = iztroBright ?? calcMinorStarBrightness(sName, branch, birthData);
      return {
        name:             sName,
        brightness:       calcBright,
        brightnessRank:   calcBright ? (BRIGHTNESS_RANK[calcBright] ?? null) : null,
        brightnessSource: iztroBright ? 'iztro' : (calcBright ? 'BlueVersion' : null),
        category:         starCategory(sName),
      };
    });

    // 小星（雜曜）
    const smallStars = p.adjectiveStars.map(s => ({
      name:       toTrad(s.name),
      brightness: null,
      category:   "雜曜",
    }));

    return {
      name:            palName,
      stemBranch:      stem + branch,
      stem:            palStem,
      branch,
      isEmpty,
      borrowedFromPalace,
      borrowedStars,
      isBodyPalace:    p.isBodyPalace,
      isOriginalPalace: p.isOriginalPalace,
      decadeRange:     p.decadal.range,
      flowYearAges:    null,   // iztro 未提供流年年齡資料
      minorLimitAges:  p.ages,

      majorStars,
      minorStars,
      smallStars,

      palaceMutagens: {
        outgoing,
        incoming,
      },

      shenshaSystem: {
        twelvePhasesOfLife: toTrad(p.changsheng12) || null,
        suiqianStar:        toTrad(p.suiqian12)    || null,
        jiangqianStar:      toTrad(p.jiangqian12)  || null,
        boshiStar:          toTrad(p.boshi12)       || null,
      },
    };
  });

  // ── 修改四：大限序列 ───────────────────────────────────────
  const majorLimits = [...r.palaces]
    .sort((a, b) => a.decadal.range[0] - b.decadal.range[0])
    .map((p, idx) => {
      const dStem    = toTrad(p.decadal.heavenlyStem);
      const dBranch  = p.decadal.earthlyBranch;
      const [startAge, endAge] = p.decadal.range;
      const mutagenStarsD = getMutagenStars(p.decadal.heavenlyStem);
      const mutagens = MUTAGEN_FULL.map((type, i) => {
        const star       = mutagenStarsD[i];
        const target     = findStarPalace(r.palaces, star);
        return {
          type,
          star,
          targetPalace: target ? modernizePalaceName(toTrad(target.name)) : null,
        };
      });

      return {
        order:      idx + 1,
        palace:     modernizePalaceName(toTrad(p.name)),
        stemBranch: p.heavenlyStem + p.earthlyBranch,
        stem:       dStem,
        startAge,
        endAge,
        startYear:  birthYear + startAge,
        endYear:    birthYear + endAge,
        mutagens,
      };
    });

  // ── 組合最終輸出 ───────────────────────────────────────────
  const result = {
    // ── 修改二：meta ────────────────────────────────────────
    meta: {
      solarDate,
      clockTime:     birthTime,
      trueSolarTime: birthTime,   // iztro 未提供真太陽時；此處填入時鐘時間
      trueSolarTimeNote: "真太陽時計算待實作（需搭配出生地經度換算）",
      longitude:     120.000,     // 預設台灣中部基準經度
      gender,
    },

    fourPillars: {
      solarTerm:    r.chineseDate,   // iztro 依節氣排月柱
      nonSolarTerm: r.chineseDate,   // iztro 僅提供一版；非節氣版本待實作
      nonSolarTermNote: "iztro 僅提供節氣版月柱，非節氣四柱待實作",
      raw: {
        yearly:  r.rawDates.chineseDate.yearly,
        monthly: r.rawDates.chineseDate.monthly,
        daily:   r.rawDates.chineseDate.daily,
        hourly:  r.rawDates.chineseDate.hourly,
      },
    },

    lifeStars: {
      mingZhu:         toTrad(r.soul),   // 命主
      shenZhu:         toTrad(r.body),   // 身主
      yearBucketStart: null,             // 斗君起始地支；iztro 未直接提供
      yearBucketNote:  "斗君需依生月地支推算，iztro 未直接輸出此欄位",
    },

    // 基本資訊（向後相容保留）
    lunarDate:       r.lunarDate,
    chineseDate:     r.chineseDate,
    shichen:         SHICHEN_NAMES[timeIndex],
    fiveElementsClass: toTrad(r.fiveElementsClass),
    yinYang,

    bodyPalace: bodyPalace ? {
      name:       modernizePalaceName(toTrad(bodyPalace.name)),
      stemBranch: bodyPalace.heavenlyStem + bodyPalace.earthlyBranch,
    } : null,

    originalPalace: originalPalace ? {
      name:       modernizePalaceName(toTrad(originalPalace.name)),
      stemBranch: originalPalace.heavenlyStem + originalPalace.earthlyBranch,
    } : null,

    yearMutagens,
    palaces,
    majorLimits,
  };

  // deepToTrad 只掃字串欄位，數字/null/boolean 直接通過
  return deepToTrad(result);
}

module.exports = { generateChart };

// ── CLI ──────────────────────────────────────────────────────
if (require.main === module) {
  const [, , solarDate, birthTime, gender] = process.argv;
  if (!solarDate || !birthTime || !gender) {
    console.error("用法：node chart-api.js YYYY-MM-DD HH:MM 男|女");
    process.exit(1);
  }
  const result = generateChart(solarDate, birthTime, gender);
  console.log(JSON.stringify(result, null, 2));
}
