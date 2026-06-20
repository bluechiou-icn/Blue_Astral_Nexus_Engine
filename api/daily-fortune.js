// Copyright (c) 2026 Blue.X. All Rights Reserved.
"use strict";

const crypto = require("crypto");

/**
 * GET /api/daily-fortune?date=&time=&gender=&targetDate=
 *
 * Tier 1 公開殼（無汎天派 IP）。
 *
 * 流程：
 *   1. 自呼 /api/flow?level=hour 取公開引擎數據（流月/流日/流時 + 三派評分）
 *   2. 嘗試載入私有生成器 lib/_private/dailyFortuneGen.js
 *        （由 scripts/pull-owner-ext.sh 在 build 時自私有 repo 拉入；
 *          缺則 fallback placeholder，doctrine 永不入 public repo）
 *   3. 對外只回 { fortuneText, tier }；owner（ane_owner cookie）多回 { debug }
 *
 * 機密邊界：五維敘事規則、健康器官對照、文字模板 = Tier 2 私有 bundle。
 *           本檔只做「呼叫引擎數學 + 轉發生成器結果」，看不到也不含 doctrine。
 *
 * Cache-Control: no-store（CLAUDE.md Rule 1）
 */
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

  const { date, time, gender, targetDate } = req.query;
  if (!date || !time || !gender || !targetDate) {
    return res.status(400).json({
      error: "缺少必填參數",
      required: { date: "YYYY-MM-DD", time: "HH:MM", gender: "男|女", targetDate: "YYYY-MM-DD" },
    });
  }

  try {
    // ── 1. 取公開引擎數據（自呼同部署的 /api/flow?level=hour）──────────
    const host  = req.headers["x-forwarded-host"] || req.headers.host;
    const proto = req.headers["x-forwarded-proto"] || "https";
    const flowUrl =
      `${proto}://${host}/api/flow?level=hour` +
      `&date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}` +
      `&gender=${encodeURIComponent(gender)}&targetDate=${encodeURIComponent(targetDate)}`;
    const flow = await fetch(flowUrl).then(r => r.json());
    if (!flow || flow.error || !flow.flowDay) {
      return res.status(502).json({ error: "引擎數據取得失敗" });
    }

    // ── 2. owner 判定（ane_owner cookie，HMAC 驗，無網路）──────────────
    const ownerEmail = verifyOwnerCookie(req.headers.cookie || "");
    const tier = ownerEmail ? "owner" : "free"; // entitlement 端點上線後改查 email tier

    // ── 3. 五維敘事（私有生成器；缺則 IP-free placeholder）──────────────
    let gen = null;
    try { gen = require("../lib/_private/dailyFortuneGen.js"); } catch (_) { /* 私有 bundle 未拉入 */ }

    let fortuneText;
    if (gen && typeof gen.generate === "function") {
      fortuneText = gen.generate(flow, tier);           // 汎天派 IP（私有）
    } else {
      fortuneText = placeholderText(flow);              // IP-free 結構佔位
    }

    const body = { fortuneText, tier };
    if (ownerEmail) body.debug = ownerDebug(flow);      // owner 專屬除錯列
    return res.status(200).json(body);
  } catch (err) {
    console.error("[/api/daily-fortune] error:", err);
    return res.status(500).json({ error: "本日運勢生成失敗" });
  }
};

// ── IP-free placeholder：僅陳述公開結構，無任何論斷 doctrine ──────────────
function placeholderText(flow) {
  const fd = flow.flowDay || {};
  const sm = flow.summary || {};
  return (
    `【本日結構】流日命宮在${fd.mingPalaceName || "—"}宮（${fd.ganZhi || "—"}日）。\n` +
    `今日最旺 ${sm.bestHour || "—"}，最弱 ${sm.worstHour || "—"}。\n` +
    `（汎天派五維論斷生成器尚未啟用，此為結構佔位文字。）`
  );
}

// ── owner debug 列（只在 owner cookie 通過時回傳）──────────────────────────
function ownerDebug(flow) {
  const fy = flow.flowYear || {}, fm = flow.flowMonth || {}, fd = flow.flowDay || {}, sm = flow.summary || {};
  return (
    `流年命宮 ${fy.mingPalaceName || "—"}(${fy.mingPalaceBranch || "—"}) · ` +
    `流月 ${fm.mingPalaceName || "—"}(${fm.mingPalaceBranch || "—"}/${fm.stem || "—"}) · ` +
    `流日 ${fd.mingPalaceName || "—"}(${fd.mingPalaceBranch || "—"}/${fd.ganZhi || "—"}) · ` +
    `best=${sm.bestHour || "—"} worst=${sm.worstHour || "—"}`
  );
}

// ── ane_owner cookie 驗章（複用 owner-check.js 簽發格式）────────────────────
function verifyOwnerCookie(cookieHeader) {
  const secret = process.env.OWNER_SESSION_SECRET || "";
  if (!secret) return null;
  const m = (cookieHeader || "").match(/(?:^|;\s*)ane_owner=([^;]+)/);
  if (!m) return null;
  const parts = m[1].split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expect = b64UrlEncode(crypto.createHmac("sha256", secret).update(payload).digest());
  if (!timingSafeEq(sig, expect)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
    if (!data.email || !data.exp || Math.floor(Date.now() / 1000) > data.exp) return null;
    return data.email;
  } catch (_) {
    return null;
  }
}

function b64UrlEncode(buf) {
  return buf.toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function timingSafeEq(a, b) {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
