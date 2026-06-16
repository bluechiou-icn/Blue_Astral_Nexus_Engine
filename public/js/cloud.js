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
  renderLibrary();
}

function cloudSignOut() {
  if (Cloud.token && typeof google !== 'undefined' && google.accounts?.oauth2?.revoke) {
    try { google.accounts.oauth2.revoke(Cloud.token, () => {}); } catch { /* noop */ }
  }
  Cloud.token = null;
  Cloud.signedIn = false;
  Cloud.fileId = null;
  try { localStorage.removeItem(SIGNIN_HINT_KEY); } catch { /* private mode */ }
  Cloud.store = loadLocalStore();    // 優雅降級回 localStorage 模式
  renderLibrary();
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
// 命例操作
// ════════════════════════════════════════════════════════

function newId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2);
}

// 起盤成功後由 app.js 呼叫：同生辰參數更新，否則新增
async function librarySaveCurrent() {
  if (!Cloud.autoSave) return;
  if (!Cloud.store) Cloud.store = loadLocalStore();
  if (typeof S === 'undefined' || !S.birthDate || !S.birthTime || !S.gender) return;
  const now = new Date().toISOString();
  const match = Cloud.store.charts.find(c =>
    c.date === S.birthDate && c.time === S.birthTime &&
    c.gender === S.gender && (c.name || '') === (S.name || ''));
  if (match) {
    match.city = S.city || '';
    match.updatedAt = now;
  } else {
    Cloud.store.charts.unshift({
      id: newId(),
      name: S.name || '',
      date: S.birthDate, time: S.birthTime, gender: S.gender,
      city: S.city || '', tags: [], notes: '',
      createdAt: now, updatedAt: now,
    });
  }
  renderLibrary();
  try { await persistStore(); } catch (e) { console.error('Library save error:', e); }
}

function libraryLoad(id) {
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
  handleSubmit();
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
  const charts = Cloud.store.charts || [];

  const authBtn = Cloud.clientId
    ? (Cloud.signedIn
        ? `<button class="lib-btn" onclick="cloudSignOut()">${t('lib_signout')}</button>`
        : `<button class="lib-btn lib-btn-google" onclick="cloudSignIn()">${t('lib_signin')}</button>`)
    : '';

  const list = charts.length
    ? charts.map(c => `
        <div class="lib-row">
          <div class="lib-info" onclick="libraryLoad('${libEscape(c.id)}')">
            <span class="lib-name">${libEscape(c.name) || '—'}</span>
            <span class="lib-meta">${libEscape(c.date)}　${libEscape(c.time)}　${tGenderShort(c.gender)}${c.city ? '　' + libEscape(c.city) : ''}</span>
          </div>
          <button class="lib-del" onclick="libraryDelete('${libEscape(c.id)}')" title="${t('lib_delete')}">✕</button>
        </div>`).join('')
    : `<div class="lib-empty">${t('lib_empty')}</div>`;

  panel.innerHTML = `
    <div class="panel-title" style="display:flex;justify-content:space-between;align-items:center;">
      <span>${t('lib_title')}</span><span>${authBtn}</span>
    </div>
    <div class="lib-status">${Cloud.signedIn ? t('lib_status_cloud') : t('lib_status_local')}</div>
    <div class="lib-list">${list}</div>
    <div class="lib-actions">
      <label class="lib-auto"><input type="checkbox" ${Cloud.autoSave ? 'checked' : ''} onchange="Cloud.autoSave=this.checked"> ${t('lib_autosave')}</label>
      <button class="lib-btn" onclick="libraryExportJSON()">${t('lib_export_json')}</button>
      <button class="lib-btn" onclick="libraryExportCSV()">${t('lib_export_csv')}</button>
      <button class="lib-btn" onclick="document.getElementById('lib-import-file').click()">${t('lib_import')}</button>
      <input type="file" id="lib-import-file" accept="application/json,.json" style="display:none" onchange="libraryImportFile(this)">
    </div>`;
}

// boot：載入本機命例 + 嘗試初始化 GIS（gsi script 的 onload 也會再呼叫一次）
(function initLibraryBoot() {
  if (typeof document === 'undefined') return;
  const boot = () => { Cloud.store = loadLocalStore(); renderLibrary(); initGIS(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

// 暴露給其他 script / 模組（const 宣告預設不會掛到 window）
if (typeof window !== 'undefined') window.Cloud = Cloud;
