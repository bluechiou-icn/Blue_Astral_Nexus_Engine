// Copyright (c) 2026 Blue.X. All Rights Reserved.
// Unauthorized copying, modification, or distribution is strictly prohibited.

/**
 * 將 24 小時制時間字串換算為 iztro timeIndex（0~12）
 *
 * @param {string} time "HH:MM" 格式
 * @returns {number} timeIndex 0~12
 */
function timeToIndex(time) {
  const [h, m] = time.split(":").map(Number);
  const minutes = h * 60 + m;

  if (minutes < 60)   return 0;  // 00:00~01:00 子時（早）
  if (minutes < 180)  return 1;  // 01:00~03:00 丑時
  if (minutes < 300)  return 2;  // 03:00~05:00 寅時
  if (minutes < 420)  return 3;  // 05:00~07:00 卯時
  if (minutes < 540)  return 4;  // 07:00~09:00 辰時
  if (minutes < 660)  return 5;  // 09:00~11:00 巳時
  if (minutes < 780)  return 6;  // 11:00~13:00 午時
  if (minutes < 900)  return 7;  // 13:00~15:00 未時
  if (minutes < 1020) return 8;  // 15:00~17:00 申時
  if (minutes < 1140) return 9;  // 17:00~19:00 酉時
  if (minutes < 1260) return 10; // 19:00~21:00 戌時
  if (minutes < 1380) return 11; // 21:00~23:00 亥時
  return 12;                     // 23:00~24:00 子時（晚）
}

const SHICHEN_NAMES = [
  "子時（早）", "丑時", "寅時", "卯時", "辰時", "巳時",
  "午時", "未時", "申時", "酉時", "戌時", "亥時", "子時（晚）",
];

module.exports = { timeToIndex, SHICHEN_NAMES };
