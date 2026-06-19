// Copyright (c) 2026 Blue.X. All Rights Reserved.
// Unauthorized copying, modification, or distribution is strictly prohibited.
"use strict";

const pkg = require("iztro");
const { astro, util } = pkg;
const { timeToIndex, SHICHEN_NAMES } = require("./utils.js");
// lunar-typescript（iztro 已將其拉為相依），用於八字起運節氣計算
let _lunarLib = null;
try { _lunarLib = require("lunar-typescript"); } catch(_) { /* graceful fallback */ }

astro.config({ language: "zh-TW" });

// ── 真太陽時校正（Blue's Version）────────────────────────────
// 規則：真太陽時 = 鐘錶時間 + (出生地經度 - 標準經度) × 4 分鐘
// 標準經度 = 時區 × 15°
const CITY_LONGITUDES = {
  '台北':121.5654,'台中':120.6839,'台南':120.2133,'高雄':120.3014,
  '新北':121.4657,'桃園':121.3010,'新竹':120.9675,'基隆':121.7391,
  '香港':114.1694,'澳門':113.5439,
  '上海':121.4737,'北京':116.4074,'廣州':113.2644,'深圳':114.0579,
  '成都':104.0665,'重慶':106.5516,'武漢':114.3054,
  '首爾':126.9780,'釜山':129.0756,
  '東京':139.6917,'大阪':135.5023,
  '曼谷':100.5018,'新加坡':103.8198,'吉隆坡':101.6869,
  '胡志明市':106.6297,'河內':105.8342,
  '洛杉磯':-118.2437,'紐約':-74.0060,'多倫多':-79.3832,
  '倫敦':-0.1276,'巴黎':2.3522,
};

const CITY_TIMEZONE_OFFSET = {
  '台北':8,'台中':8,'台南':8,'高雄':8,'新北':8,
  '桃園':8,'新竹':8,'基隆':8,
  '香港':8,'澳門':8,
  '上海':8,'北京':8,'廣州':8,'深圳':8,
  '成都':8,'重慶':8,'武漢':8,
  '首爾':9,'釜山':9,
  '東京':9,'大阪':9,
  '曼谷':7,'新加坡':8,'吉隆坡':8,
  '胡志明市':7,'河內':7,
  '洛杉磯':-8,'紐約':-5,'多倫多':-5,
  '倫敦':0,'巴黎':1,
};

function calcTrueSolarTime(clockTime, city, longitude) {
  const lon = longitude ?? CITY_LONGITUDES[city] ?? null;
  const tzOffset = city ? (CITY_TIMEZONE_OFFSET[city] ?? 8) : 8;

  if (lon === null) {
    return {
      trueSolarTime: clockTime,
      offsetMinutes: 0,
      longitude:    null,
      note: `城市「${city || '未填'}」不在資料庫，以鐘錶時間代替。`,
    };
  }

  const standardMeridian = tzOffset * 15;
  const offsetMinutes = Math.round((lon - standardMeridian) * 4);
  const [h, m] = clockTime.split(':').map(Number);
  let total = h * 60 + m + offsetMinutes;
  total = ((total % 1440) + 1440) % 1440;
  const newH = Math.floor(total / 60).toString().padStart(2, '0');
  const newM = (total % 60).toString().padStart(2, '0');

  return {
    trueSolarTime: `${newH}:${newM}`,
    offsetMinutes,
    longitude: lon,
    note: `${city || '自訂'}（東經${lon.toFixed(2)}°），鐘錶時間${offsetMinutes >= 0 ? '+' : ''}${offsetMinutes}分鐘`,
  };
}

// ── 八字起運計算（Blue's Version）────────────────────────────
// 規則：
//   陽男陰女 → 順排：找出生時刻之後的下一個「節」
//   陰男陽女 → 逆排：找出生時刻之前的上一個「節」
// 換算（傳統公式）：
//   3 日 = 1 歲，1 日 = 4 個月，1 時辰 = 10 天（在月內）
//   即 1 歲 = 36 時辰，1 月 = 3 時辰，1 時辰 = 10 天
// lunar-typescript 的 jieQiTable key 為簡體中文，這裡用簡體 keys 查表，
// 對外顯示時 normalize 為繁體
const JIE_NAMES_SIMP = ['立春','惊蛰','清明','立夏','芒种','小暑','立秋','白露','寒露','立冬','大雪','小寒'];
const JIE_SIMP_TO_TRAD = { '立春':'立春','惊蛰':'驚蟄','清明':'清明','立夏':'立夏','芒种':'芒種','小暑':'小暑','立秋':'立秋','白露':'白露','寒露':'寒露','立冬':'立冬','大雪':'大雪','小寒':'小寒' };

function _collectJieQiDates(solarYear) {
  if (!_lunarLib) return [];
  const { Solar } = _lunarLib;
  const dates = [];
  for (const yearOffset of [-1, 0, 1]) {
    const y = solarYear + yearOffset;
    try {
      const lunar = Solar.fromYmd(y, 1, 1).getLunar();
      const table = lunar.getJieQiTable();
      for (const simp of JIE_NAMES_SIMP) {
        const jq = table[simp];
        if (!jq) continue;
        const ms = new Date(jq.getYear(), jq.getMonth()-1, jq.getDay(),
                            jq.getHour(), jq.getMinute(), jq.getSecond()).getTime();
        dates.push({ name: JIE_SIMP_TO_TRAD[simp] || simp, ms, year: jq.getYear() });
      }
    } catch(e) { /* skip year */ }
  }
  return dates.sort((a,b) => a.ms - b.ms);
}

function calcBaziQiyun(solarDate, birthTime, gender, yearStem) {
  if (!_lunarLib) return null;
  const [y, m, d] = solarDate.split('-').map(Number);
  const [h, mi]   = birthTime.split(':').map(Number);
  const birthMs   = new Date(y, m-1, d, h, mi, 0).getTime();

  const yangStems = ['甲','丙','戊','庚','壬'];
  const isYang    = yangStems.includes(toTrad(yearStem));
  const isMale    = gender === '男';
  const isForward = (isYang && isMale) || (!isYang && !isMale);

  const allJie = _collectJieQiDates(y);
  if (allJie.length === 0) return null;

  let target = null;
  if (isForward) {
    target = allJie.find(j => j.ms > birthMs);
  } else {
    for (let i = allJie.length - 1; i >= 0; i--) {
      if (allJie[i].ms < birthMs) { target = allJie[i]; break; }
    }
  }
  if (!target) return null;

  const diffMs = isForward ? (target.ms - birthMs) : (birthMs - target.ms);
  const hours  = diffMs / (1000 * 60 * 60);
  const shichen = hours / 2;   // 1 時辰 = 2 小時

  // 1 歲 = 36 時辰, 1 月 = 3 時辰, 1 時辰 = 10 天 (within month)
  const years  = Math.floor(shichen / 36);
  let rem      = shichen - years * 36;
  const months = Math.floor(rem / 3);
  rem         -= months * 3;
  const days   = Math.round(rem * 10);

  return {
    years, months, days,
    direction: isForward ? '順排' : '逆排',
    jieName:   target.name,
    jieTime:   new Date(target.ms).toISOString(),
    note:      `從出生時刻${isForward ? '順數至下一個節' : '逆數至上一個節'}（${target.name}），換算 3日=1歲、1日=4月、1時辰=10天`,
  };
}

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

// ── 歲前星序列（Blue's Version） ─────────────────────────────
// 正確序列：歲建→晦氣→喪門→貫索→官符→小耗→歲破→龍德→白虎→天德→弔客→病符
// 修正說明：iztro 部分版本在位置6使用「大耗」，Blue's Version 採用「小耗」
const BRANCHES_ORDERED = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const SUIQIAN_SEQUENCE = ['歲建','晦氣','喪門','貫索','官符','小耗','歲破','龍德','白虎','天德','弔客','病符'];

function calcSuiqianStar(palaceBranch, yearBranch) {
  const yearIdx   = BRANCHES_ORDERED.indexOf(yearBranch);
  const palaceIdx = BRANCHES_ORDERED.indexOf(palaceBranch);
  const offset    = (palaceIdx - yearIdx + 12) % 12;
  return SUIQIAN_SEQUENCE[offset];
}

// ── 小限年齡計算（Blue's Version） ───────────────────────────
// 確認依據（2026-05-27）：Blue（金四局陰男，命宮=寅）1歲小限=丑，文墨天機圖驗算：
//   丑：1,13,25,37,49 ✓  卯/父母：3,15,27,39,51 ✓  子/夫妻：12,24,36,48,60 ✓
//   → 陰男 = 順行（index 遞增）
// ✓ 水二局陰男 文墨天機驗算：父母[丑]=1,13,25,37,49 → 1歲小限=丑 → 順行起點=丑
// config = [陰男起點（順行）, 陽男陰女起點（逆行）, 陽女起點（逆行）]
// 方向：陰男=順行；陽男/陰女/陽女=逆行
const MINOR_LIMIT_START = {
  '水二局': ['丑', '申', '戌'],   // ✓ 陰男文墨天機驗算；陽女=戌逆行（2026-06-05確認）
  '木三局': ['巳', '申', '戌'],   // ✓ 陽男逆行起點=申 驗算：1956-10-05陽男交友[申]=age1 確認；陽女=戌逆行
  '金四局': ['丑', '申', '戌'],   // ✓ 陰男丑位順行 Blue 確認 + 文墨天機驗算；陽女=戌逆行
  '土五局': ['未', '辰', '戌'],   // TODO: 陰男/陽男待 Blue 確認；陽女=戌逆行（2026-06-05確認）
  '火六局': ['申', '寅', '戌'],   // TODO: 陰男/陽男待 Blue 確認；陽女=戌逆行（2026-06-05確認）
};

function calcFlowYearAges(palaceBranch, fiveElements, yinYang, maxAge = 110) {
  const config = MINOR_LIMIT_START[fiveElements];
  if (!config) return null;
  // 陰男 = 順行（index 遞增）; 陽男/陰女/陽女 = 逆行（index 遞減）
  const isForward  = yinYang === '陰男';
  const startBranch = yinYang === '陽女' ? config[2]
                    : isForward           ? config[0]
                    :                       config[1];
  const startIdx   = BRANCHES_ORDERED.indexOf(startBranch);
  const branchIdx  = BRANCHES_ORDERED.indexOf(palaceBranch);
  if (startIdx === -1 || branchIdx === -1) return null;
  const ages = [];
  for (let age = 1; age <= maxAge; age++) {
    const idx = isForward
      ? (startIdx + age - 1) % 12
      : ((startIdx - (age - 1)) % 12 + 12) % 12;
    if (idx === branchIdx) ages.push(age);
  }
  return ages.length > 0 ? ages : null;
}

// ── 主函式 ───────────────────────────────────────────────────
/**
 * 生成完整命盤資料。
 *
 * ⚠️ IMPORTANT：palaces 陣列按地支順序輸出（子丑寅卯…亥），
 *    palaces[0] 不必然是命宮，命宮可能在任何 index。
 *    正確取法：palaces.find(p => p.name === '命宮')
 *    勿以 palaces[0] 假設命宮位置。
 *
 * @param {string} solarDate  - "YYYY-MM-DD"
 * @param {string} birthTime  - "HH:MM" 鐘錶時間
 * @param {"男"|"女"} gender
 * @param {string|null} city  - 出生城市（用於真太陽時校正）
 * @param {number|null} longitude - 自訂經度（覆寫城市預設值）
 * @returns {object} chart - 含 meta, palaces, majorLimits, classicalFormations, baziQiyun 等
 */
function generateChart(solarDate, birthTime, gender, city = null, longitude = null) {
  const timeIndex = timeToIndex(birthTime);

  // 真太陽時校正：依出生地經度換算
  const trueSolarTimeResult = calcTrueSolarTime(birthTime, city, longitude);
  const trueSolarTime = trueSolarTimeResult.trueSolarTime;
  // 若真太陽時與鐘錶時間不同，用真太陽時重新計算 timeIndex
  const effectiveTimeIndex = trueSolarTime !== birthTime
    ? timeToIndex(trueSolarTime)
    : timeIndex;

  // 跨時辰警示：真太陽時校正後改變時辰時，提醒命理師核實定盤
  const crossedHour = effectiveTimeIndex !== timeIndex;
  const crossedHourWarning = crossedHour
    ? `⚠️ 真太陽時校正後，時辰從「${SHICHEN_NAMES[timeIndex]}」` +
      `變更為「${SHICHEN_NAMES[effectiveTimeIndex]}」。` +
      `命盤已依真太陽時重新排盤，建議命理師核實定盤。`
    : null;

  const r = astro.bySolar(solarDate, effectiveTimeIndex, gender, true);

  // ── 生年干、陰陽 ──────────────────────────────────────────
  const yearStem   = r.rawDates.chineseDate.yearly[0];
  const yearBranch = r.rawDates.chineseDate.yearly[1];

  // ── 提取生辰干支供輔星亮度計算 ──
  const birthData = {
    yearStem:    toTrad(yearStem),
    yearBranch:  toTrad(yearBranch),
    monthBranch: toTrad(r.rawDates.chineseDate.monthly[1]),
    hourBranch:  toTrad(TIME_INDEX_TO_BRANCH[effectiveTimeIndex]),
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
      flowYearAges:    calcFlowYearAges(branch, toTrad(r.fiveElementsClass), yinYang),
      minorLimitAges:  calcFlowYearAges(branch, toTrad(r.fiveElementsClass), yinYang),

      majorStars,
      minorStars,
      smallStars,

      palaceMutagens: {
        outgoing,
        incoming,
      },

      shenshaSystem: {
        twelvePhasesOfLife: toTrad(p.changsheng12) || null,
        suiqianStar:        calcSuiqianStar(branch, birthData.yearBranch),
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
        // 虛歲對齊：第 N 歲所在西元年 = birthYear + N - 1
        // 例：1987 生 + 34 歲 → 1987 + 34 - 1 = 2020
        startYear:  birthYear + startAge - 1,
        endYear:    birthYear + endAge   - 1,
        mutagens,
      };
    });

  // ── 格局檢測 ──────────────────────────────────────────────
  const _bodyPalName = bodyPalace ? modernizePalaceName(toTrad(bodyPalace.name)) : null;
  const _origPalName = originalPalace ? modernizePalaceName(toTrad(originalPalace.name)) : null;
  const classicalFormations = detectClassicalFormations(palaces, _bodyPalName, _origPalName, yearMutagens);

  // ── 祿忌交戰靜態偵測（生年四化 vs 宮干飛化）──────────────
  const staticLuJiConflicts = detectLuJiConflict({
    palaces,
    yearMutagens,
    currentMajorLimit: null,
    flowYearMutagens:  [],
    birthYearStem:     yearStem,
    flowYearStem:      null,
  });

  // ── 組合最終輸出 ───────────────────────────────────────────
  const result = {
    // ── meta（真太陽時校正 + 跨時辰警示）─────────────────
    meta: {
      solarDate,
      clockTime:                       birthTime,
      trueSolarTime:                   trueSolarTimeResult.trueSolarTime,
      trueSolarTimeOffsetMinutes:      trueSolarTimeResult.offsetMinutes,
      trueSolarTimeNote:               trueSolarTimeResult.note,
      trueSolarTimeCrossedHour:        crossedHour,
      trueSolarTimeCrossedHourWarning: crossedHourWarning,
      city:                            city || null,
      longitude:                       trueSolarTimeResult.longitude || null,
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

    lifeStars: (() => {
      // 斗君起始地支 = 生月地支（正月寅、二月卯…依序類推）
      // BlueVersion：直接以 monthBranch 作為斗君所在宮位
      const _mb = birthData.monthBranch;
      const _mbPal = palaces.find(p => p.branch === _mb);
      return {
        mingZhu:           toTrad(r.soul),
        shenZhu:           toTrad(r.body),
        yearBucketStart:   _mb,
        yearBucketPalace:  _mbPal?.name || null,
        yearBucketNote:    `斗君在${_mb}（${_mbPal?.name || ''}宮），依生月地支推算（BlueVersion，待命理師確認）`,
      };
    })(),

    // 基本資訊（向後相容保留）
    lunarDate:       r.lunarDate,
    chineseDate:     r.chineseDate,
    shichen:         SHICHEN_NAMES[effectiveTimeIndex],
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

    classicalFormations,
    baziQiyun: calcBaziQiyun(solarDate, birthTime, gender, yearStem),
    yearMutagens,
    luJiConflicts:    staticLuJiConflicts,
    hasLuJiConflict:  staticLuJiConflicts.length > 0,
    palaces,
    majorLimits,
  };

  // deepToTrad 只掃字串欄位，數字/null/boolean 直接通過
  return deepToTrad(result);
}

// ── 祿忌交戰偵測（v2 Blue's Version）────────────────────────
function detectLuJiConflict({
  palaces,
  yearMutagens = [],
  currentMajorLimit = null,
  flowYearMutagens = [],
  birthYearStem = null,
  flowYearStem = null,
}) {
  const conflicts = [];

  for (const palace of palaces) {
    const starMutMap = {};
    const ensure = (star) => {
      if (!starMutMap[star]) starMutMap[star] = { lu: [], ji: [] };
      return starMutMap[star];
    };

    // 1. 生年四化
    for (const ym of yearMutagens) {
      if (ym.palace !== palace.name) continue;
      const slot = ensure(ym.star);
      if (ym.type === '化祿') slot.lu.push({ src: '生年', stem: birthYearStem });
      if (ym.type === '化忌') slot.ji.push({ src: '生年', stem: birthYearStem });
    }

    // 2. 大限四化
    for (const mut of (currentMajorLimit?.mutagens || [])) {
      if (mut.targetPalace !== palace.name) continue;
      const slot = ensure(mut.star);
      if (mut.type === '化祿') slot.lu.push({ src: '大限', stem: currentMajorLimit.stem });
      if (mut.type === '化忌') slot.ji.push({ src: '大限', stem: currentMajorLimit.stem });
    }

    // 3. 流年四化
    for (const fm of flowYearMutagens) {
      if (fm.targetPalace !== palace.name) continue;
      const slot = ensure(fm.star);
      if (fm.type === '化祿') slot.lu.push({ src: '流年', stem: flowYearStem });
      if (fm.type === '化忌') slot.ji.push({ src: '流年', stem: flowYearStem });
    }

    // 4. 宮干飛化（incoming mutations）
    for (const inc of (palace.palaceMutagens?.incoming || [])) {
      const slot = ensure(inc.star);
      if (inc.type === '化祿') slot.lu.push({ src: inc.fromPalace, stem: inc.fromStem });
      if (inc.type === '化忌') slot.ji.push({ src: inc.fromPalace, stem: inc.fromStem });
    }

    // 5. 偵測衝突
    for (const [star, { lu, ji }] of Object.entries(starMutMap)) {
      if (lu.length > 0 && ji.length > 0) {
        const total = lu.length + ji.length;
        const severity = total >= 4 ? 'critical' : total >= 3 ? 'high' : 'medium';
        conflicts.push({
          palace:    palace.name,
          star,
          luSources: lu,
          jiSources: ji,
          severity,
          note:      `${star}在${palace.name}：${lu.length}祿 vs ${ji.length}忌`,
        });
      }
    }
  }

  return conflicts;
}

// ── 格局檢測（Classical Formation Detection）────────────────
const BRANCH_SEQUENCE = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

function detectClassicalFormations(palaces, bodyPalName, origPalName, yearMutagens) {
  const result = [];

  const byName   = n  => palaces.find(p => p.name === n) ?? null;
  const hasMaj   = (pal, name) => pal?.majorStars?.some(s => s.name === name) ?? false;
  const hasMin   = (pal, name) => pal?.minorStars?.some(s => s.name === name) ?? false;
  const hasStar  = (pal, name) => hasMaj(pal, name) || hasMin(pal, name);
  const isSunk   = b  => ['陷','不','不利'].includes(b);
  const branchIdx = b => BRANCH_SEQUENCE.indexOf(b);
  const isAdjBranch = (b1, b2) => {
    const i1 = branchIdx(b1), i2 = branchIdx(b2);
    if (i1 < 0 || i2 < 0) return false;
    const d = Math.abs(i1 - i2);
    return d === 1 || d === 11;
  };

  const bodyPal  = bodyPalName ? byName(bodyPalName)  : null;
  const origPal  = origPalName ? byName(origPalName)  : null;
  const mingPal  = byName('命宮');
  const caiBoPal = byName('財帛');
  const qianPal  = byName('遷移');

  // ① 命宮空宮借星格
  if (mingPal?.isEmpty && mingPal.borrowedFromPalace) {
    result.push({
      name: '命宮空宮借星格',
      type: 'neutral',
      palaces: ['命宮'],
      stars: (mingPal.borrowedStars || []).map(s => s + '（借）'),
      note: '命宮空宮，人生定向取決借星宮位方向，有外地成就或飄泊特質',
      confidence: 88,
    });
  }

  // ② 身宮星組格
  if (bodyPal) {
    const hasJi  = hasMaj(bodyPal, '天機');
    const hasYin = hasMaj(bodyPal, '太陰');
    const hasZi  = hasMaj(bodyPal, '紫微');
    const hasWu  = hasMaj(bodyPal, '武曲');
    const hasFu  = hasMaj(bodyPal, '天府');

    if (hasJi && hasYin) {
      result.push({ name:'天機太陰守身宮格', type:'auspicious',
        palaces:[bodyPalName], stars:['天機','太陰'],
        note:'身宮機月同宮，智慧流動兼具，適合外向跨域、異地發展', confidence:90 });
    } else if (hasZi) {
      result.push({ name:'紫微守身格', type:'auspicious',
        palaces:[bodyPalName], stars:['紫微'],
        note:'紫微守身宮，尊貴格局，統御領導特質強', confidence:85 });
    } else if (hasWu && hasFu) {
      result.push({ name:'武府守身格', type:'auspicious',
        palaces:[bodyPalName], stars:['武曲','天府'],
        note:'武曲天府同守身宮，財富格局，善理財積累', confidence:83 });
    }
  }

  // ③ 文星群聚格（≥2 顆文星同宮）
  const LIT_STARS = ['文昌','文曲','左輔','右弼'];
  for (const pal of palaces) {
    const found = LIT_STARS.filter(s => hasStar(pal, s));
    if (found.length >= 2) {
      const isOrig = pal.name === origPalName;
      const isBody = pal.name === bodyPalName;
      const isMing = pal.name === '命宮';
      result.push({
        name: `文星群聚${pal.name}格`, type: 'auspicious',
        palaces: [pal.name], stars: found,
        note: `${found.join('+')}聚${pal.name}，學術文才格` +
          (isOrig ? '，來因宮貴人助力持續' : '') +
          (isBody ? '，身宮文氣加持' : '') +
          (isMing ? '，命宮文星聰慧博學' : ''),
        confidence: 75 + found.length * 5 + (isOrig ? 5 : 0),
      });
    }
  }

  // ④ 財宮化忌格
  if (caiBoPal) {
    for (const star of caiBoPal.majorStars || []) {
      if (star.yearMutagen !== '化忌') continue;
      result.push({
        name: `財宮${star.name}化忌${isSunk(star.brightness) ? '陷' : ''}格`,
        type: 'challenge', palaces: ['財帛'], stars: [star.name],
        note: `${star.name}${isSunk(star.brightness) ? '陷' : ''}坐財帛+生年化忌，主動財路受阻，宜轉型知識服務或被動收入`,
        confidence: isSunk(star.brightness) ? 92 : 80,
      });
    }
  }

  // ⑤ 紫府朝垣格（命遷同照）
  if ((hasMaj(mingPal,'紫微') && hasMaj(qianPal,'天府')) ||
      (hasMaj(mingPal,'天府') && hasMaj(qianPal,'紫微'))) {
    result.push({ name:'紫府朝垣格', type:'auspicious',
      palaces:['命宮','遷移'], stars:['紫微','天府'],
      note:'紫微天府分踞命遷，尊貴格局，有統御領導之象，宜政商界發展', confidence:90 });
  }

  // ⑥ 羊陀夾忌格
  const jiM = yearMutagens?.find(m => m.type === '化忌');
  if (jiM?.palace) {
    const jiPal = byName(jiM.palace);
    if (jiPal) {
      const qyPal = palaces.find(p => hasStar(p, '擎羊'));
      const tlPal = palaces.find(p => hasStar(p, '陀羅'));
      const qyAdj = qyPal && isAdjBranch(jiPal.branch, qyPal.branch);
      const tlAdj = tlPal && isAdjBranch(jiPal.branch, tlPal.branch);
      if (qyAdj || tlAdj) {
        result.push({
          name: '羊陀夾忌格', type: 'challenge',
          palaces: [jiM.palace], stars: ['擎羊','陀羅', jiM.star].filter(Boolean),
          note: '生年忌星遭羊陀夾擊，相關宮位磁場動盪，需謹慎趨避',
          confidence: (qyAdj && tlAdj) ? 93 : 76,
        });
      }
    }
  }

  // ⑦ 空劫坐命格
  if (mingPal && !mingPal.isEmpty) {
    const kk = ['地空','地劫'].filter(s => hasStar(mingPal, s));
    if (kk.length) {
      result.push({ name:'空劫坐命格', type:'challenge',
        palaces:['命宮'], stars: kk,
        note:'空劫坐命，破耗格，思路易走偏鋒，財務變動大，宜修心養性', confidence:82 });
    }
  }

  // ⑧ 祿馬同宮/交馳格
  const lucPal  = palaces.find(p => hasStar(p, '祿存'));
  const maPal   = palaces.find(p => hasStar(p, '天馬'));
  if (lucPal && maPal) {
    if (lucPal.name === maPal.name) {
      result.push({ name:'祿馬同宮格', type:'auspicious',
        palaces:[lucPal.name], stars:['祿存','天馬'],
        note:'祿存天馬同宮，流動積財格，出外求財有利，適合跨地域事業', confidence:88 });
    } else {
      const finAxis = new Set(['命宮','財帛','遷移','官祿']);
      if (finAxis.has(lucPal.name) && finAxis.has(maPal.name)) {
        result.push({ name:'祿馬交馳格', type:'auspicious',
          palaces:[lucPal.name, maPal.name], stars:['祿存','天馬'],
          note:'祿馬分踞財官遷命，奔波求財格，外地或異鄉發展有利', confidence:80 });
      }
    }
  }

  result.sort((a, b) =>
    b.confidence - a.confidence ||
    (['auspicious','neutral','challenge'].indexOf(a.type) -
     ['auspicious','neutral','challenge'].indexOf(b.type))
  );
  return result;
}

module.exports = { generateChart, BLUE_SI_HUA_TABLE };

// ── CLI ──────────────────────────────────────────────────────
if (require.main === module) {
  const [, , solarDate, birthTime, gender, city, longitudeArg] = process.argv;
  if (!solarDate || !birthTime || !gender) {
    console.error("用法：node chart-api.js YYYY-MM-DD HH:MM 男|女 [城市] [經度]");
    process.exit(1);
  }
  const lon = longitudeArg ? parseFloat(longitudeArg) : null;
  const result = generateChart(solarDate, birthTime, gender, city || null, lon);
  console.log(JSON.stringify(result, null, 2));
}
