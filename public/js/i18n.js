// ════════════════════════════════════════════════════════
// i18n — translation layer (render-layer only; engine keys stay Chinese)
// Sprint 2: full zh/en bilingual canvas. Korean UI keeps Chinese canvas
// (hanja convention); canvas helpers translate only when lang === 'en'.
// ════════════════════════════════════════════════════════
let lang = 'zh';

const I18N = {
  zh: {
    page_title: 'Blue\'s 紫微斗數命理顧問排盤系統',
    form_title: '命主資料',
    date_label: '西曆生日', time_label: '出生時間',
    gender_label: '性別', male: '男', female: '女',
    year_label: '主流年（西元，留空=本年）', year_ph: 'e.g. 2026',
    name_label: '命主姓名（選填）', name_ph: '',
    city_label: '出生城市',
    city_ph: '城市名 / 機場代號（如 BKK、ICN）',
    city_hint: '可直接輸入城市名或機場代號，例如 BKK（曼谷）、ICN（首爾）',
    email_label: 'Email（選填）', email_ph: '',
    extra_years_label: '額外流年命盤（最多選 2 個）',
    btn_submit: '起　盤', loading_text: '命盤計算中',
    flow_year_label: '主流年',
    prev_year: '← 上一年', next_year: '下一年 →',
    btn_reset: '重新輸入',
    err_required: '請填寫生日、時間和性別。',
    err_failed: '命盤計算失敗：',
    meta_wuxing: '五行局', meta_yinyang: '陰陽',
    meta_ming: '命宮', meta_body: '身宮', meta_origin: '來因宮',
    block_main: '主流年', block_extra: '額外流年',
    btn_export: '匯出', btn_export_suffix: '命盤',
    age_prefix: '虛齡', age_suffix: '歲',
    limit_label: '大限：', limit_palace: '宮',
    view_mode_label: '檢視',
    view_natal: '本命',
    view_decade: '本命＋大限',
    view_flow: '本命＋大限＋流年',
    decade_axis_label: '大限',
    year_axis_label: '流年',
    month_axis_label: '流月',
    kbd_hint: '←→ 切流年　Shift+←→ 切大限　左右滑動亦可',
    file_flow: '流年',
    // canvas 標籤（Sprint 2）
    cv_empty: '空宮',
    cv_body_box: '身宮', cv_origin_box: '來因宮', cv_minor_box: '小限',
    cv_fetal: '胎兒命',
    cv_tst_label: '真太陽時',
    cv_ming_lord: '命主', cv_shen_lord: '身主',
    cv_body_label: '身宮', cv_origin_label: '來因',
    cv_year_life: '年命',
    cv_tst_warn: '⚠ 真太陽時校正後時辰已變更，請確認定盤',
    cv_brand: "Blue's 紫微斗數命理顧問排盤系統 V3.0",
    // 命例庫（Sprint 3）
    lib_title: '命例庫',
    lib_signin: '使用 Google 登入',
    lib_signout: '登出',
    lib_status_local: '未登入：命例僅存於此瀏覽器',
    lib_status_cloud: '已連線 Google Drive（appData 隱藏資料夾，僅你本人可見）',
    lib_autosave: '起盤時自動儲存',
    lib_export_json: '匯出 JSON',
    lib_export_csv: '匯出 CSV',
    lib_import: '匯入 JSON',
    lib_empty: '尚無命例。起盤後將自動儲存於此。',
    lib_load: '載入', lib_delete: '刪除',
    lib_delete_confirm: '確定刪除此命例？',
    lib_import_done: '已匯入 {n} 筆命例',
    lib_import_bad: '檔案格式不正確',
  },
  en: {
    page_title: "Blue's Zi Wei Dou Shu Chart System",
    form_title: 'SUBJECT DATA',
    date_label: 'Date of Birth', time_label: 'Time of Birth',
    gender_label: 'Gender', male: 'Male', female: 'Female',
    year_label: 'Main Flow Year (blank = current year)', year_ph: 'e.g. 2026',
    name_label: 'Name (Optional)', name_ph: '',
    city_label: 'Birth City',
    city_ph: 'City name or airport code (e.g. BKK, ICN)',
    city_hint: 'You can type a city name or airport code, e.g. BKK (Bangkok), ICN (Seoul)',
    email_label: 'Email (Optional)', email_ph: '',
    extra_years_label: 'Additional Flow Year Charts (max 2)',
    btn_submit: 'Generate Chart', loading_text: 'Calculating...',
    flow_year_label: 'Flow Year',
    prev_year: '← Prev Year', next_year: 'Next Year →',
    btn_reset: 'Start Over',
    err_required: 'Please fill in date, time and gender.',
    err_failed: 'Chart calculation failed: ',
    meta_wuxing: 'Five Elements', meta_yinyang: 'Yin/Yang',
    meta_ming: 'Life Palace', meta_body: 'Soul Palace', meta_origin: 'Origin Palace',
    block_main: 'Main Year', block_extra: 'Extra Year',
    btn_export: 'Export', btn_export_suffix: 'Chart',
    age_prefix: 'Age ', age_suffix: '',
    limit_label: 'Major Limit: ', limit_palace: ' Palace',
    view_mode_label: 'View',
    view_natal: 'Natal',
    view_decade: '+ Decade',
    view_flow: '+ Flow Year',
    decade_axis_label: 'Decade Limits',
    year_axis_label: 'Flow Years',
    month_axis_label: 'Flow Months',
    kbd_hint: '←→ year　Shift+←→ decade　swipe also works',
    file_flow: 'flow',
    // canvas labels (Sprint 2)
    cv_empty: 'Empty',
    cv_body_box: 'BODY', cv_origin_box: 'ORIGIN', cv_minor_box: 'MINOR',
    cv_fetal: 'Prenatal',
    cv_tst_label: 'True Solar Time',
    cv_ming_lord: 'Life Lord', cv_shen_lord: 'Body Lord',
    cv_body_label: 'Body', cv_origin_label: 'Origin',
    cv_year_life: 'Flow Life',
    cv_tst_warn: '⚠ Hour changed after true-solar-time correction — please confirm',
    cv_brand: "Blue's Zi Wei Dou Shu Chart System V3.0",
    // chart library (Sprint 3)
    lib_title: 'Saved Charts',
    lib_signin: 'Sign in with Google',
    lib_signout: 'Sign out',
    lib_status_local: 'Not signed in: charts are stored in this browser only',
    lib_status_cloud: 'Connected to Google Drive (hidden appData folder, visible only to you)',
    lib_autosave: 'Auto-save on generate',
    lib_export_json: 'Export JSON',
    lib_export_csv: 'Export CSV',
    lib_import: 'Import JSON',
    lib_empty: 'No saved charts yet. Charts are saved here automatically.',
    lib_load: 'Load', lib_delete: 'Delete',
    lib_delete_confirm: 'Delete this chart?',
    lib_import_done: 'Imported {n} chart(s)',
    lib_import_bad: 'Invalid file format',
  },
  ko: {
    page_title: 'Blue\'s 자미두수 명반 시스템',
    form_title: '명주 정보',
    date_label: '양력 생일', time_label: '출생 시간',
    gender_label: '성별', male: '남', female: '여',
    year_label: '주 유년（서기, 공백=올해）', year_ph: '예: 2026',
    name_label: '이름（선택）', name_ph: '',
    city_label: '출생 도시',
    city_ph: '도시명 또는 공항 코드 (예: BKK, ICN)',
    city_hint: '도시명 또는 공항 코드를 입력하세요. 예: BKK (방콕), ICN (서울)',
    email_label: 'Email（선택）', email_ph: '',
    extra_years_label: '추가 유년 명반（최대 2개）',
    btn_submit: '명반 생성', loading_text: '명반 계산 중',
    flow_year_label: '주 유년',
    prev_year: '← 이전 년도', next_year: '다음 년도 →',
    btn_reset: '다시 입력',
    err_required: '생일, 시간, 성별을 입력해주세요.',
    err_failed: '명반 계산 실패: ',
    meta_wuxing: '오행국', meta_yinyang: '음양',
    meta_ming: '명궁', meta_body: '신궁', meta_origin: '래인궁',
    block_main: '주 유년', block_extra: '추가 유년',
    btn_export: '내보내기', btn_export_suffix: '명반',
    age_prefix: '나이 ', age_suffix: '세',
    limit_label: '대한: ', limit_palace: '궁',
    view_mode_label: '보기',
    view_natal: '본명',
    view_decade: '본명＋대한',
    view_flow: '본명＋대한＋유년',
    decade_axis_label: '대한',
    year_axis_label: '유년',
    month_axis_label: '유월',
    kbd_hint: '←→ 유년　Shift+←→ 대한　스와이프 가능',
    // 명례 보관함（Sprint 3）
    lib_title: '명례 보관함',
    lib_signin: 'Google 로그인',
    lib_signout: '로그아웃',
    lib_status_local: '미로그인: 이 브라우저에만 저장됩니다',
    lib_status_cloud: 'Google Drive 연결됨 (숨김 appData 폴더)',
    lib_autosave: '명반 생성 시 자동 저장',
    lib_export_json: 'JSON 내보내기',
    lib_export_csv: 'CSV 내보내기',
    lib_import: 'JSON 가져오기',
    lib_empty: '저장된 명례가 없습니다.',
    lib_load: '불러오기', lib_delete: '삭제',
    lib_delete_confirm: '이 명례를 삭제할까요?',
    lib_import_done: '{n}건 가져왔습니다',
    lib_import_bad: '파일 형식이 올바르지 않습니다',
  },
};

function t(key) { return I18N[lang]?.[key] ?? I18N['zh'][key] ?? key; }
function isEn() { return lang === 'en'; }

// ════════════════════════════════════════════════════════
// Canvas translation tables（Sprint 2 — engine keys 永遠是中文，
// 以下僅在 lang === 'en' 時於渲染層轉換）
// ════════════════════════════════════════════════════════

// 全星曜表：p = pinyin（畫面主名），m = 意譯（僅 14 主星）
const STAR_EN = {
  // 14 主星
  '紫微': { p: 'Zi Wei',    m: 'Emperor' },
  '天機': { p: 'Tian Ji',   m: 'Strategist' },
  '太陽': { p: 'Tai Yang',  m: 'Sun' },
  '武曲': { p: 'Wu Qu',     m: 'General' },
  '天同': { p: 'Tian Tong', m: 'Harmonizer' },
  '廉貞': { p: 'Lian Zhen', m: 'Judge' },
  '天府': { p: 'Tian Fu',   m: 'Treasurer' },
  '太陰': { p: 'Tai Yin',   m: 'Moon' },
  '貪狼': { p: 'Tan Lang',  m: 'Desire' },
  '巨門': { p: 'Ju Men',    m: 'Orator' },
  '天相': { p: 'Tian Xiang',m: 'Minister' },
  '天梁': { p: 'Tian Liang',m: 'Mentor' },
  '七殺': { p: 'Qi Sha',    m: 'Marshal' },
  '破軍': { p: 'Po Jun',    m: 'Vanguard' },
  // 八輔星
  '左輔': { p: 'Zuo Fu' },   '右弼': { p: 'You Bi' },
  '文昌': { p: 'Wen Chang' },'文曲': { p: 'Wen Qu' },
  '天魁': { p: 'Tian Kui' }, '天鉞': { p: 'Tian Yue' },
  '祿存': { p: 'Lu Cun' },   '天馬': { p: 'Tian Ma' },
  // 六凶星
  '擎羊': { p: 'Qing Yang' },'陀羅': { p: 'Tuo Luo' },
  '火星': { p: 'Huo Xing' }, '鈴星': { p: 'Ling Xing' },
  '地空': { p: 'Di Kong' },  '地劫': { p: 'Di Jie' },
  // 小星（雜曜全表，依引擎 adjectiveStars 輸出）
  '三台': { p: 'San Tai' },  '八座': { p: 'Ba Zuo' },
  '台輔': { p: 'Tai Fu' },   '封誥': { p: 'Feng Gao' },
  '恩光': { p: 'En Guang' }, '天貴': { p: 'Tian Gui' },
  '天官': { p: 'Tian Guan' },'天福': { p: 'Tian Fu+' },
  '天廚': { p: 'Tian Chu' }, '天刑': { p: 'Tian Xing' },
  '天姚': { p: 'Tian Yao' }, '解神': { p: 'Jie Shen' },
  '天巫': { p: 'Tian Wu' },  '天月': { p: 'Tian Yue+' },
  '陰煞': { p: 'Yin Sha' },  '天哭': { p: 'Tian Ku' },
  '天虛': { p: 'Tian Xu' },  '龍池': { p: 'Long Chi' },
  '鳳閣': { p: 'Feng Ge' },  '紅鸞': { p: 'Hong Luan' },
  '天喜': { p: 'Tian Xi' },  '孤辰': { p: 'Gu Chen' },
  '寡宿': { p: 'Gua Su' },   '蜚廉': { p: 'Fei Lian' },
  '破碎': { p: 'Po Sui' },   '華蓋': { p: 'Hua Gai' },
  '咸池': { p: 'Xian Chi' }, '天德': { p: 'Tian De' },
  '月德': { p: 'Yue De' },   '天才': { p: 'Tian Cai' },
  '天壽': { p: 'Tian Shou' },'天空': { p: 'Tian Kong' },
  '旬空': { p: 'Xun Kong' }, '空亡': { p: 'Kong Wang' },
  '截路': { p: 'Jie Lu' },   '年解': { p: 'Nian Jie' },
  '天傷': { p: 'Tian Shang' },'天使': { p: 'Tian Shi' },
};

// 12 宮位（命宮 Life、夫妻 Spouse…）＋ 縮寫（疊盤標記用）
const PALACE_EN = {
  '命宮': 'Life',     '兄弟': 'Siblings', '夫妻': 'Spouse',  '子女': 'Children',
  '財帛': 'Wealth',   '疾厄': 'Health',   '遷移': 'Travel',  '交友': 'Friends',
  '官祿': 'Career',   '田宅': 'Property', '福德': 'Wellbeing','父母': 'Parents',
};
const PALACE_EN_S = {
  '命宮': 'Life', '兄弟': 'Sib', '夫妻': 'Spo', '子女': 'Chd',
  '財帛': 'Wea',  '疾厄': 'Hea', '遷移': 'Tra', '交友': 'Fri',
  '官祿': 'Car',  '田宅': 'Pro', '福德': 'Wel', '父母': 'Par',
};

// 天干 / 地支 pinyin
const STEM_EN = {
  '甲':'Jia','乙':'Yi','丙':'Bing','丁':'Ding','戊':'Wu',
  '己':'Ji','庚':'Geng','辛':'Xin','壬':'Ren','癸':'Gui',
};
const BRANCH_EN = {
  '子':'Zi','丑':'Chou','寅':'Yin','卯':'Mao','辰':'Chen','巳':'Si',
  '午':'Wu','未':'Wei','申':'Shen','酉':'You','戌':'Xu','亥':'Hai',
};

// 亮度八等級（Blue's Version：廟>旺>得>利>平>不利>陷>不）
const BRIGHT_EN = {
  '廟':'Exalt', '旺':'Bright', '得':'Favor', '利':'Gain',
  '平':'Even', '不利':'Adverse', '陷':'Fallen', '不':'Nadir',
};

// 四化（祿 Prosperity／權 Authority／科 Merit／忌 Obstacle）— 徽章用 pinyin 縮寫
const MU_EN = { '祿':'Lu', '權':'Quan', '科':'Ke', '忌':'Ji' };

// 生肖
const ZODIAC_EN = {
  '鼠':'Rat','牛':'Ox','虎':'Tiger','兔':'Rabbit','龍':'Dragon','蛇':'Snake',
  '馬':'Horse','羊':'Goat','猴':'Monkey','雞':'Rooster','狗':'Dog','豬':'Pig',
};

// 五行
const ELEM_EN = { '水':'Water','木':'Wood','金':'Metal','土':'Earth','火':'Fire' };
const CN_DIGIT = { '〇':0,'零':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9 };

// 流年吉凶星
const FLOW_TRANS_EN = {
  '流祿':'fLu','流羊':'fYang','流陀':'fTuo','流馬':'fMa',
  '流昌':'fChang','流曲':'fQu','流魁':'fKui','流鉞':'fYue',
};

// ── 翻譯 helpers（zh 模式一律原樣返回，確保 zh 畫面零變動）──
function tStar(name)        { return isEn() ? (STAR_EN[name]?.p || name) : name; }
function tStarMeaning(name) { return isEn() ? (STAR_EN[name]?.m || '') : ''; }
function tBright(b)         { return isEn() ? (BRIGHT_EN[b] || b) : b; }
function tMuBadge(ch)       { return isEn() ? (MU_EN[ch] || ch) : ch; }
function tStem(s)           { return isEn() ? (STEM_EN[s] || s) : s; }
function tBranch(b)         { return isEn() ? (BRANCH_EN[b] || b) : b; }
function tGZ(gz) {
  if (!isEn() || !gz || gz.length < 2) return gz;
  return (STEM_EN[gz[0]] || gz[0]) + '-' + (BRANCH_EN[gz[1]] || gz[1]);
}
// 宮名：tPalaceName 不加宮字（meta/chips 用）；tPalaceFull 完整宮名（canvas 用）
// 注意：引擎宮名僅「命宮」帶宮字（兄弟/夫妻…不帶），查表須原名與去尾雙查
function tPalaceName(n) {
  if (!n) return n;
  return isEn() ? (PALACE_EN[n] || PALACE_EN[n.replace(/宮$/, '')] || n) : n;
}
function tPalaceFull(n) {
  if (!n) return n;
  if (isEn()) return tPalaceName(n);
  return n.endsWith('宮') ? n : n + '宮';
}
function tPalaceShort(n) {
  if (!n) return n;
  if (isEn()) return PALACE_EN_S[n] || PALACE_EN_S[n.replace(/宮$/, '')] || tPalaceName(n);
  // zh：交友 → 友（palaceCharZh 統一處理），其餘取首字
  return (typeof palaceCharZh === 'function' ? palaceCharZh(n) : (n.replace(/宮$/, '').charAt(0))) || n.charAt(0);
}
// 流月農曆月名（zh: 正月…臘月；en: M1…M12）
function tMonthName(m) {
  if (isEn()) return 'M' + m;
  return (typeof LUNAR_MONTH_NAMES !== 'undefined' && LUNAR_MONTH_NAMES[m - 1]) || (m + '月');
}
function tZodiac(z)   { return isEn() ? (ZODIAC_EN[z] || z) : z; }
function tWuXingJu(s) {
  if (!isEn() || !s) return s;
  const el = ELEM_EN[s[0]] || s[0];
  const n  = CN_DIGIT[s[1]] ?? '';
  return `${el}-${n}`;
}
function tYinYang(s) {
  if (!isEn() || !s) return s;
  return s.replace('陰','Yin ').replace('陽','Yang ').replace('男','Male').replace('女','Female').trim();
}
function tShichen(s) {
  if (!isEn() || !s) return s;
  return (BRANCH_EN[s[0]] || s[0]) + ' Hr';
}
function tGenderShort(g) { return isEn() ? (g === '男' ? 'M' : g === '女' ? 'F' : g) : g; }
function tFlowTrans(l)   { return isEn() ? (FLOW_TRANS_EN[l] || l) : l; }

// 農曆日期中文 → EN（「一九九九年冬月廿五」→「Lunar 1999-11-25」，閏月加 (leap)）
function tLunarDate(s) {
  if (!isEn() || !s) return s;
  const m = s.match(/^(.+?)年(閏?)(.+?)月(.+)$/);
  if (!m) return s;
  const year = [...m[1]].map(c => CN_DIGIT[c] ?? '?').join('');
  const MONTHS = { '正':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'冬':11,'臘':12,'十一':11,'十二':12 };
  const month = MONTHS[m[3]] ?? '?';
  const dayMap = { '初':0, '十':10, '廿':20, '卅':30 };
  let day;
  const ds = m[4];
  if (ds === '十') day = 10;
  else if (ds === '二十') day = 20;
  else if (ds === '三十') day = 30;
  else if (ds.length === 2 && ds[0] in dayMap) day = dayMap[ds[0]] + (CN_DIGIT[ds[1]] ?? (ds[1] === '十' ? 10 : 0));
  else if (ds.length === 2 && ds[0] === '二' && ds[1] === '十') day = 20;
  else day = CN_DIGIT[ds] ?? '?';
  return `Lunar ${year}-${month}-${day}${m[2] ? ' (leap)' : ''}`;
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const v = t(el.dataset.i18n);
    if (v !== undefined) el.innerHTML = v;
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const v = t(el.dataset.i18nPh);
    if (v !== undefined) el.placeholder = v;
  });
  document.querySelectorAll('.lbtn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('onclick')?.includes(`'${lang}'`));
  });
  // update city default placeholder label on f-city
  const cityInp = document.getElementById('f-city');
  if (cityInp) cityInp.placeholder = t('city_ph');
}

function setLang(l) {
  lang = l;
  applyI18n();
  if (typeof renderLibrary === 'function') renderLibrary();
  // re-render dynamic areas if chart is showing
  if (typeof S !== 'undefined' && S.chartData) {
    updateMetaBar(); updateFlowBar(); renderViewModeBar(); renderAxes();
    buildChartBlocks(); renderAllCharts();
  }
}
