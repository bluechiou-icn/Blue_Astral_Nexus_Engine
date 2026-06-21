// ════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════

const PAL_SEQ = ['命宮','兄弟','夫妻','子女','財帛','疾厄','遷移','交友','官祿','田宅','福德','父母'];

const BRANCH_POS = {
  '巳':[0,0],'午':[0,1],'未':[0,2],'申':[0,3],
  '辰':[1,0],                        '酉':[1,3],
  '卯':[2,0],                        '戌':[2,3],
  '寅':[3,0],'丑':[3,1],'子':[3,2],'亥':[3,3],
};

// 太歲輪序列：寅→丑（從寅年開始順時針一週共 12 年）
const YIN_SEQ = ['寅','卯','辰','巳','午','未','申','酉','戌','亥','子','丑'];
const HEAVENLY_STEMS   = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const EARTHLY_BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

// 取得某年的天干地支
function getYearStem(year)   { return HEAVENLY_STEMS[(year - 4) % 10]; }
function getYearBranch(year) { return EARTHLY_BRANCHES[(year - 4) % 12]; }

// 立春日（2月幾號），近似公式，適用 1900–2100
function lichunDay(year) {
  const base = year >= 2000 ? 2000 : 1900;
  return Math.floor((year - base) * 0.2422 + 4.4475) - Math.floor((year - base) / 4);
}
// 農曆（紫微）干支年起訖（立春→次年立春前一日）
function lunarYearRange(year) {
  const sd = lichunDay(year);
  const ed = new Date(year + 1, 1, lichunDay(year + 1));  // 次年立春
  ed.setDate(ed.getDate() - 1);                            // 前一日
  return {
    start: `${year}/2/${sd}`,
    end:   `${ed.getFullYear()}/${ed.getMonth() + 1}/${ed.getDate()}`,
  };
}
// 出生日對應的干支年（立春前算前一年）
function birthGanZhiYear(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const lichun = lichunDay(y);
  if (m < 2 || (m === 2 && d < lichun)) return y - 1;
  return y;
}

// 計算某宮位地支對應的「流年資訊」（依當前流年所在的太歲輪）
// 例：流年 2026 丙午年 → 寅位=2022壬寅, 卯位=2023癸卯, ... 丑位=2033癸丑
function getPalaceFlowYear(palaceBranch, flowYear, flowBranch) {
  const baseYear = flowYear - YIN_SEQ.indexOf(flowBranch);  // 起始寅年
  const yearOffset = YIN_SEQ.indexOf(palaceBranch);
  const year = baseYear + yearOffset;
  return { year, stem: getYearStem(year), branch: palaceBranch };
}

// 五虎遁：年干／大限干 → 正月(寅月)天干起點（與 lib/liushi.js 同步，前端流月用）
const WUHU_DUN = {
  '甲':'丙','己':'丙',  '乙':'戊','庚':'戊',  '丙':'庚','辛':'庚',
  '丁':'壬','壬':'壬',  '戊':'甲','癸':'甲',
};

// 流月命宮：流年命宮為正月，順數至目標農曆月（汎天派順數法）
function flowMonthBranch(flowYearMingBranch, lunarMonth) {
  const i = EARTHLY_BRANCHES.indexOf(flowYearMingBranch);
  if (i < 0) return null;
  return EARTHLY_BRANCHES[(i + (lunarMonth - 1)) % 12];
}
// 流月天干：五虎遁定正月天干，順推至目標月
function flowMonthStemOf(flowYearStem, lunarMonth) {
  const i = HEAVENLY_STEMS.indexOf(WUHU_DUN[flowYearStem]);
  if (i < 0) return null;
  return HEAVENLY_STEMS[(i + (lunarMonth - 1)) % 10];
}

// 農曆月名（正月…臘月）
const LUNAR_MONTH_NAMES = ['正月','二月','三月','四月','五月','六月','七月','八月','九月','十月','冬月','臘月'];

// 宮名單字縮寫（zh）：交友 → 友（其餘取首字）
function palaceCharZh(n) {
  if (!n) return n;
  const base = n.replace(/宮$/, '');
  return base === '交友' ? '友' : base.charAt(0);
}

// Mutagen color by SOURCE
const MU_BY_SRC = {
  year:   { bg:'#c0392b', fg:'#fff' },  // 生年 紅
  decade: { bg:'#16542d', fg:'#fff' },  // 大限 深綠 (per user spec)
  flow:   { bg:'#2563eb', fg:'#fff' },  // 流年 藍
};
const MU_KEY = { '化祿':'祿', '化權':'權', '化科':'科', '化忌':'忌' };

// Star category colors
const CLR_MAJOR = '#1e3a8a';   // 主星 深藍 (加粗)
const CLR_AUX   = '#7c3aed';   // 吉/輔星 紫色
const CLR_KILL  = '#c0392b';   // 凶星 紅色
const CLR_SMALL = '#60a5fa';   // 小星 淺藍

// Brand & accent colors
const BRAND_TIFFANY = '#0abab5';
const GOLD_HIGHLIGHT = '#d4af37';
const SILVER_HIGHLIGHT = '#9aa0a6';  // 手動點擊三方四正：偏銀色的灰（與流年金色區隔）
const RED_BOX = '#c0392b';
const DECADE_HIGHLIGHT = '#16542d';  // 大限命宮高亮（檢視模式：本命＋大限）

// Zodiac map (生肖)
const ZODIACS = {'子':'鼠','丑':'牛','寅':'虎','卯':'兔','辰':'龍','巳':'蛇','午':'馬','未':'羊','申':'猴','酉':'雞','戌':'狗','亥':'豬'};

// Brightness colors for light bg
const BRIGHT_CLR = {
  '廟':'#c46e0f', '旺':'#d97706',
  '得':'#92400e', '利':'#9a3412',
  '平':'#78716c',
  '不利':'#a8a29e',
  '陷':'#b8a89e',
  '不':'#c8b8a8',
};

// Star category membership
const AUX_STARS  = new Set(['左輔','右弼','文昌','文曲','天魁','天鉞','祿存','天馬']);
const KILL_STARS = new Set(['擎羊','陀羅','火星','鈴星','地空','地劫']);

// Canvas geometry
const CELL = 250;
const BASE = 1000;
const PAD  = 10;
const BOT  = 68;  // bottom reserve (流年資訊 + 大限年範圍 + 宮位名)
const LJ_MARGIN = 36;  // outer margin for 祿忌交戰 badges (outside chart grid)
const DPR  = window.devicePixelRatio || 1;
const FONT = '"PingFang TC","Microsoft JhengHei","Heiti TC",sans-serif';
const FONT_EN = '"Inter","Helvetica Neue",Arial,sans-serif';  // EN 模式幾何無襯線

// ════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════
const S = {
  chartData: null,
  flowData: null,                  // legacy single (= flowDataByYear[currentYear])
  flowDataByYear: {},              // {year: flowData}
  yearBlocks: [],                  // [{year, gz, canvasId}]
  birthDate: '', birthTime: '', gender: '', name: '', city: '',
  currentYear: new Date().getFullYear(),
  // 檢視模式：'natal' 本命 | 'decade' 本命＋大限 | 'flow' 本命＋大限＋流年
  viewMode: 'flow',
  // 三方四正互動：點擊宮位後高亮對宮+三合
  selectedBranch: null,
  dashOffset: 0,
  trineRaf: null,
  // 流月命宮地支：點 month chip 時設，gotoYear / gotoDecade 清。
  // chart-render 用此推算十二宮位「月X」標籤（月命→月父順排）。
  monthMingBranch: null,
  // 手勢：滑動後短暫抑制 click（避免誤觸三方四正選取）
  lastSwipeTs: 0,
};

// ════════════════════════════════════════════════════════
// UTILS
// ════════════════════════════════════════════════════════

function palOffset(n, ref) {
  const i = PAL_SEQ.indexOf(n), j = PAL_SEQ.indexOf(ref);
  if (i < 0 || j < 0) return null;
  return PAL_SEQ[(i - j + 12) % 12];
}

function buildMuMap(yearM, decadeM, flowM) {
  const map = {};
  const add = (arr, src) => {
    for (const m of arr||[]) {
      const pal = m.palace ?? m.targetPalace; if (!pal) continue;
      (map[pal] = map[pal]||[]).push({ type: m.type, star: m.star, src });
    }
  };
  add(yearM,'year'); add(decadeM,'decade'); add(flowM,'flow');
  return map;
}

function ts() { return new Date().toISOString().replace(/\D/g,'').slice(0,8); }

// 大限工具：找出涵蓋某流年的大限
function limitForYear(year) {
  const lims = S.chartData?.majorLimits || [];
  return lims.find(l => year >= l.startYear && year <= l.endYear) || null;
}


// 暴露給其他 script / 模組（const 預設不會掛到 window）
if (typeof window !== 'undefined') window.S = S;
