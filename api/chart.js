// Copyright (c) 2026 Blue.X. All Rights Reserved.
// Unauthorized copying, modification, or distribution is strictly prohibited.
"use strict";

const { generateChart } = require("../chart-api.js");
const { validateBirthData } = require("../lib/validate.js");

/**
 * Vercel Serverless Function
 * GET /api/chart?date=YYYY-MM-DD&time=HH:MM&gender=男|女
 */
module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { date, time, gender, city, longitude } = req.query;

  if (!date || !time || !gender) {
    return res.status(400).json({
      error: "缺少必填參數",
      required: { date: "YYYY-MM-DD", time: "HH:MM", gender: "男|女" },
      example: "/api/chart?date=2000-01-01&time=06:00&gender=男",
    });
  }

  const vErr = validateBirthData({ date, time, gender, city, longitude });
  if (vErr) return res.status(400).json({ error: vErr });

  try {
    const lon = longitude ? parseFloat(longitude) : null;
    const chart = generateChart(date, time, gender, city || null, lon);

    if (process.env.DEBUG_QIYUN === "1") {
      console.log("baziQiyun raw:", JSON.stringify(chart?.baziQiyun || null));
    }

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Surrogate-Control", "no-store");
    return res.status(200).json(chart);
  } catch (err) {
    console.error("[/api/chart] error:", err);
    return res.status(500).json({ error: "命盤計算失敗" });
  }
};
