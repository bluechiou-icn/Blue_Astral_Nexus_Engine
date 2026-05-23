"use strict";

const { generateChart } = require("../chart-api.js");

/**
 * Vercel Serverless Function
 * GET /api/chart?date=YYYY-MM-DD&time=HH:MM&gender=男|女
 */
module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

// ── API Key 驗證 ───────────────────────────────────────────
  // const secret = process.env.API_SECRET;
  // const provided = req.headers["x-api-key"];
  // if (!secret || !provided || provided !== secret) {
  //   return res.status(401).json({ error: "Unauthorized" });
  // }

  const { date, time, gender } = req.query;

  // ── 驗證必填參數 ──────────────────────────────────────────
  if (!date || !time || !gender) {
    return res.status(400).json({
      error: "缺少必填參數",
      required: { date: "YYYY-MM-DD", time: "HH:MM", gender: "男|女" },
      example: "/api/chart?date=YYYY-MM-DD&time=05:17&gender=男",
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "date 格式錯誤，應為 YYYY-MM-DD" });
  }

  if (!/^\d{2}:\d{2}$/.test(time)) {
    return res.status(400).json({ error: "time 格式錯誤，應為 HH:MM" });
  }

  if (!["男", "女"].includes(gender)) {
    return res.status(400).json({ error: "gender 只接受 男 或 女" });
  }

  try {
    const chart = generateChart(date, time, gender);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(chart);
  } catch (err) {
    return res.status(500).json({ error: "命盤計算失敗", message: err.message });
  }
};
