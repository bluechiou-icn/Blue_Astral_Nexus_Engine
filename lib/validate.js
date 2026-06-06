// Copyright (c) 2026 Blue.X. All Rights Reserved.
// 共用輸入驗證 — 給所有 API 端點使用
"use strict";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const GENDERS = new Set(["男", "女"]);
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;
const MAX_CITY_LEN = 50;

/**
 * 驗證一組生辰資料；回傳第一個錯誤訊息，或 null 表示通過。
 * @param {object} p { date, time, gender, [city], [longitude] }
 * @param {string} [tag] - 多盤合盤時的標籤（如 "A"），會附在錯誤訊息前
 */
function validateBirthData(p, tag) {
  const px = tag ? `[${tag}] ` : "";
  if (!DATE_RE.test(p.date)) return `${px}date 格式錯誤，應為 YYYY-MM-DD`;
  if (!TIME_RE.test(p.time)) return `${px}time 格式錯誤，應為 HH:MM`;
  if (!GENDERS.has(p.gender)) return `${px}gender 只接受 男 或 女`;

  // 年份合理範圍
  const yr = parseInt(p.date.slice(0, 4), 10);
  if (isNaN(yr) || yr < MIN_YEAR || yr > MAX_YEAR) {
    return `${px}date 年份須介於 ${MIN_YEAR}–${MAX_YEAR}`;
  }
  // 時分合理範圍
  const [hh, mm] = p.time.split(":").map(Number);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return `${px}time 時分數值錯誤`;
  }
  // 城市長度上限（防濫用，避免後端 token 暴漲）
  if (p.city != null && String(p.city).length > MAX_CITY_LEN) {
    return `${px}city 長度上限 ${MAX_CITY_LEN}`;
  }
  // 經度範圍
  if (p.longitude != null && p.longitude !== "") {
    const lon = parseFloat(p.longitude);
    if (isNaN(lon) || lon < -180 || lon > 180) {
      return `${px}longitude 須為 -180–180`;
    }
  }
  return null;
}

/**
 * 驗證流年查詢年份。
 */
function validateQueryYear(year) {
  const n = parseInt(year, 10);
  if (isNaN(n) || n < MIN_YEAR || n > MAX_YEAR) {
    return `year 須為 ${MIN_YEAR}–${MAX_YEAR} 整數`;
  }
  return null;
}

module.exports = {
  DATE_RE, TIME_RE, GENDERS,
  MIN_YEAR, MAX_YEAR, MAX_CITY_LEN,
  validateBirthData,
  validateQueryYear,
};
