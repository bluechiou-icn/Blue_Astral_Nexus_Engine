// ════════════════════════════════════════════════════════
// CLOUD — Google 登入 + Drive appDataFolder 命例庫（Sprint 3）
//
// 鐵律（Step 0 = Encryption 檢核）：
// - access token 僅存記憶體，嚴禁落 localStorage / cookie
// - GOOGLE_CLIENT_ID 為公開值（CLAUDE.md Rule 2），可進前端
// - 命例只存出生參數與註記，不存排盤結果（盤由引擎即時重算）
// - 個人資料只進使用者自己的 Drive appDataFolder，伺服器不經手
//
// 未登入：命例存 localStorage。登入後：本機與雲端合併上傳，
// localStorage 保留為離線鏡像，登出 / token 失效時優雅降級。
// ════════════════════════════════════════════════════════

// drive.appdata 用於命例庫加密儲存；userinfo.email 用於 owner 身分驗證
// （Sprint 3.5 加入；只看 email，不存任何個資）。
const DRIVE_SCOPE    = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email';
const CLOUD_FILENAME = 'aethnous-charts.json';
const CATEGORIES_FILENAME = 'aethnous-categories.json';
const LOCAL_KEY      = 'aethnous_charts_v1';
// 非敏感旗標：上次曾成功登入過。token 仍只在記憶體（CLAUDE.md Rule 2 不變），
// 此旗標僅供 silent re-auth 判斷是否值得嘗試無 UI 取 token。
const SIGNIN_HINT_KEY = 'aethnous_signin_hint';

const Cloud = {
  // Blue 於 GCP Console 建立 OAuth Client ID（Web）後，
  // 填入 chart.html 內的 window.AETHNOUS_GOOGLE_CLIENT_ID。
  // 留空 = 不顯示登入按鈕，純 localStorage 模式。
  clientId: (typeof window !== 'undefined' && window.AETHNOUS_GOOGLE_CLIENT_ID) || '',
  token: null,           // access token（記憶體 only）
  tokenClient: null,
  fileId: null,
  signedIn: false,
  store: null,           // { version: 1, updatedAt, charts: [] }
  autoSave: true,
  // Sprint 3.9 H4：分類索引（讀自 Drive appData/aethnous-categories.json；由 scripts/admin-setup.js 初始化）
  categories: [],        // [{ id, slug, displayName, icon, default, folderId, createdAt }]
  categoriesFileId: null,
  activeCategoryFilter: null,  // slug | null；renderLibrary 套用後只顯示該分類命例
  entitlement: null,           // Feature 1（2026-06-20）：{ tier, maxRecords, dailyFortune, owner }；登入後由 /api/entitlement 填
  // E1（Blue 2026-06-27）：命例「修改模式」
  // libraryEdit(id) 設定 → librarySaveCurrent 改走 id 比對，允許 date/time/gender/name 變更覆寫同一筆，
  // 避免改關鍵 4 欄產生重複。卡片本體點擊（view mode）保持 null，走原本 4-key match。
  editingId: null,
};

function libEscape(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ════════════════════════════════════════════════════════
// Store（資料模型 version 1）
// ════════════════════════════════════════════════════════

function emptyStore() {
  return { version: 1, updatedAt: new Date().toISOString(), charts: [] };
}

function validStore(j) {
  return j && j.version === 1 && Array.isArray(j.charts);
}

function loadLocalStore() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return emptyStore();
    const j = JSON.parse(raw);
    return validStore(j) ? j : emptyStore();
  } catch { return emptyStore(); }
}

function saveLocalStore(store) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(store)); } catch { /* private mode 等 */ }
}

// 合併兩份 store：同 id（或同生辰參數）取 updatedAt 較新者。
// library-level 欄位（除 charts 外）以較新 updatedAt 那一份為準保留，
// 確保未來 schema evolution（額外的 store-level 欄位）不會在合併時被丟棄。
function mergeStores(a, b) { return mergeStoresWithDiff(a, b).merged; }

// 帶 diff 的合併：回報雲端覆蓋本機（cloudWins）與本機覆蓋雲端（localWins）的筆數，
// 給 UI 在登入後 toast 告知使用者。多裝置情境下避免「靜默覆蓋」的不安感。
function mergeStoresWithDiff(local, cloud) {
  const keyOf = c => c.id || `${c.date}|${c.time}|${c.gender}|${c.name || ''}`;
  const localMap = new Map();
  const cloudMap = new Map();
  for (const c of (local?.charts || [])) localMap.set(keyOf(c), c);
  for (const c of (cloud?.charts || [])) cloudMap.set(keyOf(c), c);

  const mergedMap = new Map();
  let cloudWins = 0;  // 雲端版本較新，覆蓋本機（remote-newer-than-local）
  let localWins = 0;  // 本機版本較新或僅本機獨有（local-newer-or-only）
  let cloudOnly = 0;  // 僅雲端有（首次跨裝置拉回）

  const allKeys = new Set([...localMap.keys(), ...cloudMap.keys()]);
  for (const k of allKeys) {
    const l = localMap.get(k);
    const c = cloudMap.get(k);
    if (l && !c) { mergedMap.set(k, l); localWins++; continue; }
    if (c && !l) { mergedMap.set(k, c); cloudOnly++; continue; }
    const lt = l.updatedAt || '';
    const ct = c.updatedAt || '';
    if (lt === ct) { mergedMap.set(k, c); }            // 同步狀態，不算衝突
    else if (lt > ct) { mergedMap.set(k, l); localWins++; }
    else { mergedMap.set(k, c); cloudWins++; }
  }

  const newer = ((local?.updatedAt || '') > (cloud?.updatedAt || '')) ? local : cloud;
  const merged = { ...emptyStore(), ...(newer || {}) };
  merged.charts = [...mergedMap.values()]
    .sort((x, y) => (y.updatedAt || '').localeCompare(x.updatedAt || ''));
  return { merged, cloudWins, localWins, cloudOnly };
}

// 寫入：登入時上雲，localStorage 永遠保留離線鏡像
async function persistStore() {
  if (!Cloud.store) return;
  Cloud.store.updatedAt = new Date().toISOString();
  saveLocalStore(Cloud.store);
  if (Cloud.signedIn) await driveUpload(Cloud.store);
}

// ════════════════════════════════════════════════════════
// Google Identity Services（OAuth token client，scope 僅 drive.appdata）
// ════════════════════════════════════════════════════════

function initGIS() {
  if (Cloud.tokenClient) return;
  if (!Cloud.clientId) return;
  if (typeof google === 'undefined' || !google.accounts?.oauth2) return;
  Cloud.tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: Cloud.clientId,
    scope: DRIVE_SCOPE,
    callback: onCloudToken,
    // silent re-auth 失敗（Google session 不在 / 使用者拒絕等）由此攔截，
    // 維持目前未登入 UX，不彈錯誤對話。
    error_callback: () => { /* silent fail; user can click 登入 鈕 */ },
  });
  renderLibrary();
  trySilentReauth();
}

// Silent re-auth：refresh 後若上次曾登入且 Google session 還在，
// 無 UI 自動取 token 復原 Drive 連線（不存 token，只看記憶體旗標）。
function trySilentReauth() {
  if (Cloud.signedIn) return;
  if (!Cloud.tokenClient) return;
  let hint = null;
  try { hint = localStorage.getItem(SIGNIN_HINT_KEY); } catch { /* private mode */ }
  if (hint !== '1') return;
  try {
    Cloud.tokenClient.requestAccessToken({ prompt: '' });
  } catch { /* GIS not ready; will retry on user click */ }
}

function cloudSignIn() {
  if (!Cloud.tokenClient) initGIS();
  if (Cloud.tokenClient) Cloud.tokenClient.requestAccessToken();
}

async function onCloudToken(resp) {
  if (!resp || !resp.access_token) return;
  Cloud.token = resp.access_token;   // 記憶體 only，不落任何儲存
  Cloud.signedIn = true;
  try { localStorage.setItem(SIGNIN_HINT_KEY, '1'); } catch { /* private mode */ }
  try {
    const cloudStore = await loadCloudStore();
    const localStore = loadLocalStore();
    const diff = mergeStoresWithDiff(localStore, cloudStore);
    Cloud.store = diff.merged;
    await persistStore();            // 合併結果回寫雲端 + 本機鏡像
    notifyCloudSync(diff);           // 告知使用者衝突解決結果
  } catch (e) {
    console.error('Cloud sync error:', e);
  }
  // Sprint 3.9 H4：登入後拉分類索引。找不到 categories.json 不阻斷主流程
  // （表示 admin-setup.js 還沒跑 — 命例庫仍可用，只是分類功能 disabled）
  try { await loadCategories(); } catch (e) { console.warn('loadCategories failed:', e); }
  // Feature 1：拉方案層級（命例 quota）。失敗不阻斷 — 保守降級為 free。
  try { await loadEntitlement(); } catch (e) { console.warn('loadEntitlement failed:', e); }
  renderLibrary();
  // 通知 owner-ext 重新渲染 chip row（categories 已就緒）
  try { window.dispatchEvent(new CustomEvent('aethnous-categories-updated')); } catch { /* noop */ }
}

function cloudSignOut() {
  if (Cloud.token && typeof google !== 'undefined' && google.accounts?.oauth2?.revoke) {
    try { google.accounts.oauth2.revoke(Cloud.token, () => {}); } catch { /* noop */ }
  }
  Cloud.token = null;
  Cloud.signedIn = false;
  Cloud.fileId = null;
  // Sprint 3.9 H4：登出時清掉 categories（避免 ext bundle 拿到 stale list）
  Cloud.categories = [];
  Cloud.categoriesFileId = null;
  Cloud.activeCategoryFilter = null;
  Cloud.entitlement = null;
  try { localStorage.removeItem(SIGNIN_HINT_KEY); } catch { /* private mode */ }
  Cloud.store = loadLocalStore();    // 優雅降級回 localStorage 模式
  renderLibrary();
  try { window.dispatchEvent(new CustomEvent('aethnous-categories-updated')); } catch { /* noop */ }
}

// 同步結果輕量 toast；無變更則不打擾使用者。
function notifyCloudSync(diff) {
  if (!diff || (diff.cloudWins === 0 && diff.localWins === 0 && diff.cloudOnly === 0)) return;
  const parts = [];
  if (diff.cloudWins > 0)
    parts.push(t('sync_cloud_wins').replace('{n}', diff.cloudWins));
  if (diff.localWins > 0)
    parts.push(t('sync_local_wins').replace('{n}', diff.localWins));
  if (diff.cloudOnly > 0)
    parts.push(t('sync_cloud_only').replace('{n}', diff.cloudOnly));
  showCloudToast('☁ ' + parts.join('　'));
}

function showCloudToast(msg) {
  let host = document.getElementById('cloud-toast');
  if (!host) {
    host = document.createElement('div');
    host.id = 'cloud-toast';
    host.style.cssText =
      'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);'
      + 'background:rgba(26,26,26,0.92);color:#fff;padding:10px 18px;'
      + 'border-radius:6px;font-size:12px;letter-spacing:0.05em;z-index:9999;'
      + 'box-shadow:0 6px 24px rgba(0,0,0,0.28);max-width:90%;opacity:0;'
      + 'transition:opacity 0.25s ease;pointer-events:none;';
    document.body.appendChild(host);
  }
  host.textContent = msg;
  // 強制 reflow 後再改 opacity 才會 transition
  void host.offsetWidth;
  host.style.opacity = '1';
  clearTimeout(host._hideTimer);
  host._hideTimer = setTimeout(() => { host.style.opacity = '0'; }, 4500);
}

// ════════════════════════════════════════════════════════
// Drive REST（appDataFolder）
// ════════════════════════════════════════════════════════

async function driveFetch(url, opts = {}) {
  const r = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${Cloud.token}`, ...(opts.headers || {}) },
  });
  if (r.status === 401) {
    // token 過期 → 降級為本機模式，使用者可重新登入
    Cloud.token = null; Cloud.signedIn = false;
    renderLibrary();
    throw new Error('auth expired');
  }
  if (!r.ok) throw new Error('Drive HTTP ' + r.status);
  return r;
}

async function driveFindFile() {
  const q = encodeURIComponent(`name='${CLOUD_FILENAME}'`);
  const r = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,name)`);
  const j = await r.json();
  return j.files?.[0]?.id || null;
}

async function loadCloudStore() {
  Cloud.fileId = await driveFindFile();
  if (!Cloud.fileId) return emptyStore();
  const r = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${Cloud.fileId}?alt=media`);
  const j = await r.json();
  return validStore(j) ? j : emptyStore();
}

async function driveUpload(store) {
  const body = JSON.stringify(store);
  if (Cloud.fileId) {
    await driveFetch(
      `https://www.googleapis.com/upload/drive/v3/files/${Cloud.fileId}?uploadType=media`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
  } else {
    const boundary = 'aethnous' + Date.now();
    const meta = { name: CLOUD_FILENAME, parents: ['appDataFolder'] };
    const multipart =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
    const r = await driveFetch(
      `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id`,
      { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body: multipart });
    Cloud.fileId = (await r.json()).id;
  }
}

// ════════════════════════════════════════════════════════
// Categories（Sprint 3.9 H4）— 分類索引讀寫
// 由 scripts/admin-setup.js 初始化；UI 透過 Cloud.setCategoryFilter() 切換。
// ════════════════════════════════════════════════════════

async function loadCategories() {
  if (!Cloud.signedIn) { Cloud.categories = []; return; }
  const q = encodeURIComponent(`name='${CATEGORIES_FILENAME}' and trashed=false`);
  const r = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,name)`);
  const j = await r.json();
  const fileId = j.files?.[0]?.id || null;
  Cloud.categoriesFileId = fileId;
  if (!fileId) { Cloud.categories = []; return; }
  const r2 = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
  const data = await r2.json();
  Cloud.categories = (data && data.version === 1 && Array.isArray(data.categories))
    ? data.categories : [];
}

async function saveCategories() {
  if (!Cloud.signedIn) return;
  const body = JSON.stringify({
    version: 1,
    categories: Cloud.categories,
    updatedAt: new Date().toISOString(),
  });
  if (Cloud.categoriesFileId) {
    await driveFetch(
      `https://www.googleapis.com/upload/drive/v3/files/${Cloud.categoriesFileId}?uploadType=media`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
    return;
  }
  const boundary = 'aethnouscat' + Date.now();
  const meta = { name: CATEGORIES_FILENAME, parents: ['appDataFolder'] };
  const multipart =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
  const r = await driveFetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id`,
    { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body: multipart });
  Cloud.categoriesFileId = (await r.json()).id;
}

// Public API for owner-ext bundle / chart.html save button
function setCategoryFilter(slugOrNull) {
  Cloud.activeCategoryFilter = slugOrNull || null;
  renderLibrary();
}

function getCategories() {
  return Cloud.categories.slice();  // defensive copy
}

// ════════════════════════════════════════════════════════
// 命例操作
// ════════════════════════════════════════════════════════

function newId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2);
}

// 起盤成功後由 app.js 呼叫：同生辰參數更新，否則新增。
// opts: { categoryId?, skipAutoSaveCheck? }  — Sprint 3.9 H4：支援指定分類儲存
//   - skipAutoSaveCheck=true 由「手動儲存到分類」UI 使用，繞過 autoSave 開關
// Feature 1（2026-06-20）：方案層級 + 命例 quota
//   命例存於用戶自己的 Drive（伺服器不經手），故 quota 為「產品軟閘」非安全牆：
//   前端據 entitlement 擋「新增第 N+1 筆」。tier 由 /api/entitlement 依 email 權威判定。
async function loadEntitlement() {
  if (!Cloud.signedIn || !Cloud.token) { Cloud.entitlement = null; return; }
  const r = await fetch(`/api/entitlement?_t=${Date.now()}`, {
    headers: { Authorization: `Bearer ${Cloud.token}` },
  });
  if (!r.ok) { Cloud.entitlement = null; return; }
  Cloud.entitlement = await r.json();
}

// 是否可再新增一筆命例。未知 entitlement → 保守視為 free(1)。maxRecords null = 無上限。
function canAddRecord() {
  const ent = Cloud.entitlement;
  const max = ent && ('maxRecords' in ent) ? ent.maxRecords : 1;
  if (max == null) return true;
  const n = (Cloud.store && Array.isArray(Cloud.store.charts)) ? Cloud.store.charts.length : 0;
  return n < max;
}

async function librarySaveCurrent(opts) {
  opts = opts || {};
  // 未登入不寫 localStorage（Sprint 3.9 P4 補強）：
  // 防共用瀏覽器情境下訪客起盤資料殘留，避免之後 owner 登入時 merge 衝突。
  // 命例儲存只發生於登入後 → Drive appData + localStorage 離線鏡像同步。
  if (!Cloud.signedIn) return;
  if (!Cloud.autoSave && !opts.skipAutoSaveCheck) return;
  if (!Cloud.store) Cloud.store = loadLocalStore();
  if (typeof S === 'undefined' || !S.birthDate || !S.birthTime || !S.gender) return;
  const now = new Date().toISOString();
  // E1（Blue 2026-06-27）：修改模式（editingId 設）→ 一律按 id 找現有筆，允許 4 個關鍵欄位變更覆寫同一筆，
  // 避免改 date/time/gender/name 之一就產生重複命例。view 模式（editingId=null）走原本 4-key match。
  const match = Cloud.editingId
    ? Cloud.store.charts.find(c => c.id === Cloud.editingId)
    : Cloud.store.charts.find(c =>
        c.date === S.birthDate && c.time === S.birthTime &&
        c.gender === S.gender && (c.name || '') === (S.name || ''));
  // Feature 1 quota：改現有命例(match)永遠放行；新增超過上限 → 派事件供 UI 顯示升級提示，不寫入。
  if (!match && !canAddRecord()) {
    try {
      window.dispatchEvent(new CustomEvent('aethnous-quota-exceeded', {
        detail: { tier: Cloud.entitlement?.tier || 'free', maxRecords: Cloud.entitlement?.maxRecords ?? 1 },
      }));
    } catch { /* noop */ }
    return;
  }
  if (match) {
    // E1：修改模式可改 4 個關鍵欄位（view 模式下這 4 欄本就同值，寫回為 no-op）
    match.name   = S.name || '';
    match.date   = S.birthDate;
    match.time   = S.birthTime;
    match.gender = S.gender;
    match.city   = S.city || '';
    if (opts.categoryId !== undefined) match.categoryId = opts.categoryId || null;
    match.updatedAt = now;
  } else {
    Cloud.store.charts.unshift({
      id: newId(),
      name: S.name || '',
      date: S.birthDate, time: S.birthTime, gender: S.gender,
      city: S.city || '', tags: [], notes: '',
      categoryId: opts.categoryId || null,
      createdAt: now, updatedAt: now,
    });
  }
  renderLibrary();
  try { await persistStore(); } catch (e) { console.error('Library save error:', e); }
}

function libraryLoad(id, editMode = false) {
  const c = Cloud.store?.charts.find(x => x.id === id);
  if (!c) return;
  if (typeof S !== 'undefined' && S.chartData && typeof resetChart === 'function') resetChart();
  document.getElementById('f-date').value = c.date;
  document.getElementById('f-time').value = c.time;
  const fg = document.querySelector(`input[name=g][value="${c.gender}"]`);
  if (fg) fg.checked = true;
  document.getElementById('f-name').value = c.name || '';
  const fc = document.getElementById('f-city');
  if (fc && c.city) fc.value = c.city;
  // 還原已定盤狀態（v3 後加入；舊資料無此欄位視同 true，保持向後相容）
  const fcs = document.getElementById('f-chartset');
  if (fcs) fcs.checked = c.chartSet !== false;
  // E1（Blue 2026-06-27）：editMode=true（從 ✎ 鈕進入）→ 設 editingId，librarySaveCurrent 走 id 路徑覆寫同一筆。
  // editMode=false（卡片本體點擊，view 語意）→ 清 editingId，走原本 4-key match。
  // _loadingFromLibrary 旗標讓 handleSubmit 不要在 libraryLoad 觸發的呼叫裡清掉剛設好的 editingId。
  Cloud.editingId = editMode ? id : null;
  Cloud._loadingFromLibrary = true;
  try { handleSubmit(); } finally { Cloud._loadingFromLibrary = false; }
}

// E1：從 ✎ 鈕進入修改模式 — 等同 libraryLoad(id, true)。
function libraryEdit(id) {
  return libraryLoad(id, true);
}

async function libraryDelete(id) {
  if (!Cloud.store) return;
  if (!confirm(t('lib_delete_confirm'))) return;
  Cloud.store.charts = Cloud.store.charts.filter(c => c.id !== id);
  renderLibrary();
  try { await persistStore(); } catch (e) { console.error('Library delete error:', e); }
}

// ════════════════════════════════════════════════════════
// 匯出（JSON / CSV → 使用者可自行放 iCloud Drive）/ 匯入
// ════════════════════════════════════════════════════════

function downloadBlob(content, filename, type) {
  const a = document.createElement('a');
  const url = URL.createObjectURL(new Blob([content], { type }));
  a.href = url; a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function libraryExportJSON() {
  if (!Cloud.store) return;
  downloadBlob(JSON.stringify(Cloud.store, null, 2), 'aethnous-charts.json', 'application/json');
}

function libraryExportCSV() {
  if (!Cloud.store) return;
  const cols = ['id', 'name', 'date', 'time', 'gender', 'city', 'tags', 'notes', 'createdAt', 'updatedAt'];
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [cols.join(',')];
  for (const c of Cloud.store.charts) {
    rows.push(cols.map(k => esc(k === 'tags' ? (c.tags || []).join(';') : c[k])).join(','));
  }
  // BOM 讓 Excel 正確辨識 UTF-8
  downloadBlob('\uFEFF' + rows.join('\r\n'), 'aethnous-charts.csv', 'text/csv;charset=utf-8');
}

function libraryImportFile(input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const j = JSON.parse(reader.result);
      if (!validStore(j)) throw new Error('bad format');
      const valid = j.charts.filter(c =>
        /^\d{4}-\d{2}-\d{2}$/.test(c.date || '') &&
        /^\d{2}:\d{2}$/.test(c.time || '') &&
        (c.gender === '男' || c.gender === '女'));
      Cloud.store = mergeStores(Cloud.store || emptyStore(), { version: 1, charts: valid });
      renderLibrary();
      await persistStore();
      alert(t('lib_import_done').replace('{n}', valid.length));
    } catch {
      alert(t('lib_import_bad'));
    }
    input.value = '';
  };
  reader.readAsText(file);
}

// ════════════════════════════════════════════════════════
// UI
// ════════════════════════════════════════════════════════

function renderLibrary() {
  const panel = document.getElementById('library-panel');
  if (!panel) return;
  if (!Cloud.store) Cloud.store = loadLocalStore();
  // 顯示順序：selfChartId（命主本人）永遠在最上；其後 partnerIds 緊鄰命主之下；
  // 其餘 chart 按 updatedAt desc。避免「partner 在 main 之上」的奇怪順序。
  // Sprint 3.9 H4：若 activeCategoryFilter 已設，先以 categoryId 篩 charts。
  // self / partner 在篩選後若不屬於該分類則不強行置頂，避免分類視角下出現「不該在這裡」的命例。
  const filterCat = Cloud.activeCategoryFilter || null;
  // 分類解析（Blue 2026-06-26 修，真因）：命例的 categoryId 指向 store.categories
  // （{id:'cat_1', name:'家人'}，私有 bundle 維護），但舊邏輯去 Cloud.categories 找 .slug
  // → 兩套陣列＋兩種欄位對不上 → 永遠篩不到（= Blue 點分類全空）。
  // 改為：把 activeCategoryFilter（可能是 id / name / slug）解析到實際 category 的 id，
  // 再比對 chart.categoryId。解析不到就退回原值（容錯）。
  const allCats = [ ...((Cloud.store && Cloud.store.categories) || []), ...(Cloud.categories || []) ];
  const matchCat = filterCat
    ? allCats.find(c => c && (c.id === filterCat || c.name === filterCat || c.slug === filterCat || c.displayName === filterCat))
    : null;
  const filterId = matchCat ? matchCat.id : filterCat;
  const filteredAll = filterCat
    ? (Cloud.store.charts || []).filter(c => c.categoryId === filterId)
    : (Cloud.store.charts || []);
  const all = filteredAll;
  const selfId = Cloud.store.selfChartId || null;
  const selfChart = selfId ? all.find(c => c.id === selfId) : null;
  const partnerIds = new Set(selfChart?.partnerIds || []);
  const partnerCharts = all.filter(c => partnerIds.has(c.id))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const others = all.filter(c => c.id !== selfId && !partnerIds.has(c.id))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const charts = [
    ...(selfChart ? [selfChart] : []),
    ...partnerCharts,
    ...others,
  ];

  const authBtn = Cloud.clientId
    ? (Cloud.signedIn
        ? `<button class="lib-btn" onclick="cloudSignOut()">${t('lib_signout')}</button>`
        : `<button class="lib-btn lib-btn-google" onclick="cloudSignIn()">${t('lib_signin')}</button>`)
    : '';

  // 隱私防線（Sprint 3.9 v2，Blue 2026-06-19 強化）：
  // 未登入 → 命例庫 panel 只保留 title + 登入按鈕，完全不洩漏「有多少筆」「狀態為何」等 metadata。
  // 登入後才渲染 status / list / actions。export/import/autosave 也僅限登入後可用。
  if (!Cloud.signedIn) {
    panel.innerHTML =
      `<div class="panel-title" style="display:flex;justify-content:space-between;align-items:center;">` +
      `<span>${t('lib_title')}</span><span>${authBtn}</span></div>`;
    return;
  }

  // 預設不列全部命例（Blue 2026-06-20）：登入後若未選分類，render placeholder + 內建分類選單，
  // 避免命例混雜呈現；user 必須先挑分類才看到清單。owner-ext bundle 整合（Q2）後 ext chip row 也會
  // 走同一個 setCategoryFilter，兩個入口共用 state，不會互相打架。
  const actionsHtml = `
    <div class="lib-actions">
      <label class="lib-auto"><input type="checkbox" ${Cloud.autoSave ? 'checked' : ''} onchange="Cloud.autoSave=this.checked"> ${t('lib_autosave')}</label>
      <button class="lib-btn" onclick="libraryExportJSON()">${t('lib_export_json')}</button>
      <button class="lib-btn" onclick="libraryExportCSV()">${t('lib_export_csv')}</button>
      <button class="lib-btn" onclick="document.getElementById('lib-import-file').click()">${t('lib_import')}</button>
      <input type="file" id="lib-import-file" accept="application/json,.json" style="display:none" onchange="libraryImportFile(this)">
    </div>`;

  // 隱私預設（Blue 2026-06-26 釐清，**重要**）：登入後預設「不顯示任何命例」，必須點分類才顯示
  // 該分類命例。原因＝Blue 線上諮詢會分享/錄影螢幕；諮詢前先把該命主放進獨立分類，分享時對方
  // 只會看到自己的資料，不會看到其他命主的生日（隱私）。故未選分類時只渲染 placeholder
  // （不含任何命主姓名/生日）。先前一度改成「預設列全部」是隱私倒退，已還原。
  if (!filterCat) {
    panel.innerHTML = `
      <div class="panel-title" style="display:flex;justify-content:space-between;align-items:center;">
        <span>${t('lib_title')}</span><span>${authBtn}</span>
      </div>
      <div class="lib-status">${t('lib_status_cloud')}</div>
      <div class="lib-empty">${t('lib_pick_category')}</div>
      ${actionsHtml}`;
    return;
  }

  const list = charts.length
    ? charts.map(c => `
        <div class="lib-row">
          <div class="lib-info" onclick="libraryLoad('${libEscape(c.id)}')">
            <span class="lib-name">${libEscape(c.name) || '—'}</span>
            <span class="lib-meta">${libEscape(c.date)}　${libEscape(c.time)}　${tGenderShort(c.gender)}${c.city ? '　' + libEscape(c.city) : ''}</span>
          </div>
          <button class="lib-edit" onclick="libraryEdit('${libEscape(c.id)}')" title="${t('lib_edit')}">✎</button>
          <button class="lib-del" onclick="libraryDelete('${libEscape(c.id)}')" title="${t('lib_delete')}">✕</button>
        </div>`).join('')
    : `<div class="lib-empty">${t('lib_empty_category')}</div>`;

  // B2 收尾（Blue 2026-06-26）：移除命例庫內重複的分類 chip row（我 Self／伴 Partner／
  // 家 Family／客 Client／例 Case Study／全部）。它與上方私有 bundle 的分類列（家人/姐妹/…）
  // 功能重複，Blue 指定刪除；篩選交給上方那排即可。
  panel.innerHTML = `
    <div class="panel-title" style="display:flex;justify-content:space-between;align-items:center;">
      <span>${t('lib_title')}</span><span>${authBtn}</span>
    </div>
    <div class="lib-status">${t('lib_status_cloud')}</div>
    <div class="lib-list">${list}</div>
    ${actionsHtml}`;
}

// boot：載入本機命例 + 嘗試初始化 GIS（gsi script 的 onload 也會再呼叫一次）
(function initLibraryBoot() {
  if (typeof document === 'undefined') return;
  const boot = () => { Cloud.store = loadLocalStore(); renderLibrary(); initGIS(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

// 暴露給其他 script / 模組（const 宣告預設不會掛到 window）
// Sprint 3.9 H4：對 owner-ext bundle 暴露分類 API：
//   Cloud.getCategories() / Cloud.setCategoryFilter(slug|null)
//   Cloud.activeCategoryFilter / Cloud.categories
//   Cloud.loadCategories() / Cloud.saveCategories()
//   librarySaveCurrent({ categoryId, skipAutoSaveCheck }) — chart.html 儲存按鈕用
if (typeof window !== 'undefined') {
  Cloud.getCategories = getCategories;
  Cloud.setCategoryFilter = setCategoryFilter;
  Cloud.loadCategories = loadCategories;
  Cloud.saveCategories = saveCategories;
  Cloud.librarySaveCurrent = librarySaveCurrent;
  Cloud.libraryEdit = libraryEdit;           // E1：對外暴露修改模式入口（inline onclick 也用 global window.libraryEdit）
  Cloud.canAddRecord = canAddRecord;        // Feature 1：UI 判定是否可新增命例
  Cloud.loadEntitlement = loadEntitlement;  // Feature 1：手動重拉方案層級
  window.libraryEdit = libraryEdit;          // inline HTML onclick 需要 global function
  window.Cloud = Cloud;
}
