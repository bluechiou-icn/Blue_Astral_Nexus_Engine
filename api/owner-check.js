// Copyright (c) 2026 Blue.X. All Rights Reserved.
"use strict";

const crypto = require("crypto");

/**
 * GET /api/owner-check
 *
 * 驗證 Authorization: Bearer <google_access_token>，比對 email 對應到
 * OWNER_EMAIL_ALLOWLIST（Vercel env var，逗號分隔）。
 *
 * 通過 → 簽發 HttpOnly + Secure cookie `ane_owner=<payload>.<hmac>`
 *        （以 OWNER_SESSION_SECRET 簽章，Max-Age=3600）。
 *        後續 /ext/* 由 middleware.js 在 edge 驗 cookie 放行。
 *
 * 失敗 → { owner: false }，不洩漏理由。
 *
 * Cache-Control: no-store（CLAUDE.md Rule 1）
 */
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    return res.status(200).json({ owner: false });
  }

  const auth = req.headers["authorization"] || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(200).json({ owner: false });
  const token = m[1];

  const allowlist = (process.env.OWNER_EMAIL_ALLOWLIST || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  const secret = process.env.OWNER_SESSION_SECRET || "";

  if (allowlist.length === 0 || !secret) {
    // 缺設定 → fail-closed
    return res.status(200).json({ owner: false });
  }

  try {
    const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return res.status(200).json({ owner: false });
    const info = await r.json();
    const email = (info.email || "").toLowerCase();
    const verified = info.email_verified === true || info.email_verified === "true";
    if (!email || !verified) return res.status(200).json({ owner: false });
    if (!allowlist.includes(email)) return res.status(200).json({ owner: false });

    // 簽發 cookie
    const maxAge = 3600; // 1 小時
    const exp = Math.floor(Date.now() / 1000) + maxAge;
    const payload = b64UrlEncode(Buffer.from(JSON.stringify({ email, exp })));
    const sig = b64UrlEncode(
      crypto.createHmac("sha256", secret).update(payload).digest()
    );
    const cookie = `${payload}.${sig}`;
    res.setHeader(
      "Set-Cookie",
      `ane_owner=${cookie}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`
    );
    return res.status(200).json({
      owner: true,
      user: { email, name: info.name || "", picture: info.picture || "" },
    });
  } catch (_) {
    return res.status(200).json({ owner: false });
  }
};

function b64UrlEncode(buf) {
  return buf.toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
