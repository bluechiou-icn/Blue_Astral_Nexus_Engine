// Vercel Edge Middleware
//
// 守門 /ext/* — owner-only 擴充靜態資源。
// 非 owner（缺 cookie / cookie 簽章不合 / 已過期）→ 404（故意不回 401/403）。
//
// Flow：
//   1) Client 完成 Google login → owner-ext.js 打 /api/owner-check (Bearer token)
//   2) /api/owner-check 驗 token → email 比對 OWNER_EMAIL_ALLOWLIST →
//      Set-Cookie: ane_owner=<base64url(payload)>.<base64url(hmac)>;
//                  HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600
//   3) Client dynamic import('/ext/index.js') — browser 自動帶上 cookie
//   4) 此 middleware 在 edge 驗 cookie 簽章 + exp，過了放行，否則 404
//
// 為什麼用 cookie 而不是 Bearer header：
//   - 動態 import() 不能設 Authorization header，只能依賴 cookie / query
//   - cookie HttpOnly 比 query string 安全（不會 leak 到 referrer / server log）

export const config = {
  matcher: ["/ext/:path*"],
};

export default async function middleware(req) {
  const cookieHdr = req.headers.get("cookie") || "";
  const cookie = parseCookie(cookieHdr, "ane_owner");
  if (!cookie) return notFound();

  const secret = process.env.OWNER_SESSION_SECRET || "";
  if (!secret) return notFound();

  const valid = await verifyOwnerCookie(cookie, secret);
  if (!valid) return notFound();

  // 通過：return undefined → Vercel 繼續走原本的靜態檔交付
  return undefined;
}

// ─────────────────────────────────────────────
function notFound() {
  return new Response("Not Found", {
    status: 404,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Surrogate-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

function parseCookie(hdr, name) {
  for (const part of hdr.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

async function verifyOwnerCookie(cookie, secret) {
  const dot = cookie.lastIndexOf(".");
  if (dot < 0) return false;
  const body = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);
  try {
    const expected = await hmacSha256(secret, body);
    if (!timingSafeEqual(expected, sig)) return false;
    const json = JSON.parse(b64UrlDecodeToStr(body));
    if (!json || !json.email || !json.exp) return false;
    if (Date.now() / 1000 > json.exp) return false;
    return true;
  } catch (_) {
    return false;
  }
}

async function hmacSha256(secret, msg) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const buf = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return b64UrlEncode(new Uint8Array(buf));
}

function b64UrlEncode(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64UrlDecodeToStr(s) {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  return atob(b64);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
