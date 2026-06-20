// Copyright (c) 2026 Blue.X. All Rights Reserved.
"use strict";

/**
 * GET /api/entitlement   (Authorization: Bearer <google_access_token>)
 *
 * 依登入 email 比對 env allowlist，回傳該用戶的方案層級與命例上限。
 *   → { tier, maxRecords, dailyFortune, owner }
 *
 * tier 解析（first match）：
 *   OWNER_EMAIL_ALLOWLIST  逗號分隔 → owner  (無上限)  ← 複用既有 owner-check 變數
 *   AGENT_EMAIL_ALLOWLIST  逗號分隔 → agent  (無上限)
 *   TIER_MAP               JSON {"email":"lv2"} → 指定層級
 *   其餘                              → free   (1 筆)
 *
 * maxRecords: null = 無上限。
 * 注意：命例存於用戶自己的 Drive（伺服器不經手），此端點僅供前端 UI 判定，
 *       quota 為產品軟閘非安全牆。Cache-Control: no-store（Rule 1）。
 */
const TIER_MAX = {
  owner:  null,
  agent:  null,
  master: null,
  lv5:    20,
  lv4:    10,
  lv3:    5,
  lv2:    3,
  free:   1,
};

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const fallback = { tier: "free", maxRecords: TIER_MAX.free, dailyFortune: true, owner: false };
  if (req.method !== "GET") return res.status(200).json(fallback);

  const auth = req.headers["authorization"] || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(200).json(fallback);

  try {
    const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${m[1]}` },
    });
    if (!r.ok) return res.status(200).json(fallback);
    const info = await r.json();
    const email = (info.email || "").toLowerCase();
    const verified = info.email_verified === true || info.email_verified === "true";
    if (!email || !verified) return res.status(200).json(fallback);

    const tier = resolveTier(email);
    return res.status(200).json({
      tier,
      maxRecords: tier in TIER_MAX ? TIER_MAX[tier] : TIER_MAX.free,
      dailyFortune: true,
      owner: tier === "owner",
    });
  } catch (_) {
    return res.status(200).json(fallback);
  }
};

function resolveTier(email) {
  const list = key =>
    (process.env[key] || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

  if (list("OWNER_EMAIL_ALLOWLIST").includes(email)) return "owner";
  if (list("AGENT_EMAIL_ALLOWLIST").includes(email)) return "agent";

  try {
    const map = JSON.parse(process.env.TIER_MAP || "{}");
    const lower = {};
    for (const k of Object.keys(map)) lower[k.toLowerCase()] = map[k];
    const t = lower[email];
    if (t && t in TIER_MAX) return t;
  } catch (_) { /* TIER_MAP 格式錯 → 略過 */ }

  return "free";
}
