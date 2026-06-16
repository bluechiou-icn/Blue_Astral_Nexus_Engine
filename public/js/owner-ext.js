// ════════════════════════════════════════════════════════
// OWNER EXTENSIONS LOADER
//
// 公開檔。功能：使用者完成 Google 登入後，向 /api/owner-check 確認是否
// 為 owner 允許清單成員，若是則動態載入 /ext/index.js（owner-only 擴充）。
//
// 對非 owner 使用者：靜默 no-op。所有失敗路徑都不顯示錯誤、不顯示痕跡。
// 對 owner：載入 ext 後由 ext.init() 自行接管 UI 注入。
//
// 安全層級：
//   1. /api/owner-check 必須 server-side 驗 access token → email 後比對 allowlist
//   2. /ext/* 由 middleware.js 在 edge 上守門（雙保險，回 404 而非 403）
//   3. 此檔不引用、不暴露任何 owner-only 欄位名稱或 schema
// ════════════════════════════════════════════════════════
(function () {
  if (typeof window === 'undefined') return;
  if (window.__OWNER_EXT_LOADER__) return;
  window.__OWNER_EXT_LOADER__ = true;

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let loaded = false;

  async function tryLoad() {
    if (loaded) return true;
    if (!window.Cloud || !window.Cloud.signedIn || !window.Cloud.token) return false;
    try {
      const r = await fetch('/api/owner-check', {
        headers: { Authorization: 'Bearer ' + window.Cloud.token },
        cache: 'no-store',
      });
      if (!r.ok) return false;
      const j = await r.json();
      if (!j || j.owner !== true) return false;
      const mod = await import('/ext/index.js');
      if (mod && typeof mod.init === 'function') {
        mod.init({ user: j.user || {} });
      }
      loaded = true;
      return true;
    } catch (_) {
      return false;
    }
  }

  function boot() {
    (async () => {
      // 嘗試最多 60 次（每 1s 一次），cover OAuth callback 的時序
      for (let i = 0; i < 60; i++) {
        if (await tryLoad()) return;
        await wait(1000);
      }
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
