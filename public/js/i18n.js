// ════════════════════════════════════════════════════════
// i18n — translation layer (render-layer only; engine keys stay Chinese)
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
    kbd_hint: '←→ 切流年　Shift+←→ 切大限　左右滑動亦可',
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
    kbd_hint: '←→ year　Shift+←→ decade　swipe also works',
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
    kbd_hint: '←→ 유년　Shift+←→ 대한　스와이프 가능',
  },
};

function t(key) { return I18N[lang]?.[key] ?? I18N['zh'][key] ?? key; }

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
  // re-render dynamic areas if chart is showing
  if (typeof S !== 'undefined' && S.chartData) {
    updateMetaBar(); updateFlowBar(); renderViewModeBar(); renderAxes();
    buildChartBlocks(); renderAllCharts();
  }
}
