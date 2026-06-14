// Copyright (c) 2026 Blue.X. All Rights Reserved.
"use strict";

/**
 * GET /api/info
 * Self-description endpoint — lets any agent discover available endpoints,
 * required params, and key output fields without prior documentation.
 */
module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Surrogate-Control", "no-store");
  return res.status(200).json({
    engine:  "Blue Astral Nexus Engine",
    school:  "汎天派 / 飛星派（紫微斗數・Blue's Version）",
    baseUrl: "https://engine.aethnous.co",
    note:    "append &_t=YYYYMMDD to any call to bypass agent-side caching",
    endpoints: [
      {
        path:    "/api/chart",
        method:  "GET",
        purpose: "本命盤：十二宮星曜、四化飛宮（飛出/飛入/自化）、格局、大限序列、來因宮、身宮",
        params: {
          required: { date: "YYYY-MM-DD", time: "HH:MM（鐘錶時間）", gender: "男|女" },
          optional: { city: "出生城市（真太陽時校正）", longitude: "自訂東經度數（覆寫城市）" },
        },
        example: "/api/chart?date=2000-01-01&time=06:00&gender=男&_t=20260614",
        keyOutputFields: {
          "originalPalace":               "來因宮（label/name/stem/branch/stemBranch）",
          "bodyPalace":                   "身宮（label/name/stem/branch/stemBranch）",
          "palaces[].palaceMutagens":     "{ outgoing: 本宮飛出四化[], incoming: 其他宮飛入本宮[] }",
          "palaces[].majorStars[].selfTransformation": "自化（↓祿/↓忌 等）",
          "majorLimits[]":                "大限序列（stem/startYear/endYear/mutagens）",
          "yearMutagens":                 "生年四化（type/star/palace）",
          "classicalFormations":          "格局清單（name/confidence/palaces）",
          "luJiConflicts":                "靜態祿忌交戰偵測",
          "baziQiyun":                    "八字起運（大運起始歲數/方向）",
          "fiveElementsClass":            "五行局（水二局/木三局等）",
          "yinYang":                      "陰陽（陰男/陽女等）",
        },
      },
      {
        path:    "/api/flow",
        method:  "GET",
        purpose: "流年盤：大限/小限/流年四化/流年吉凶星/祿忌交戰/三干疊加",
        params: {
          required: { date: "YYYY-MM-DD", time: "HH:MM", gender: "男|女", year: "YYYY（查詢年份）" },
        },
        example: "/api/flow?date=2000-01-01&time=06:00&gender=男&year=2026&_t=20260614",
        keyOutputFields: {
          "flowYearMutagens":         "流年四化（落宮宮名）",
          "flowYearTransients":       "流年吉凶星落支（流祿/流羊/流陀/流馬/流昌/流曲/流魁/流鉞）",
          "currentMajorLimit":        "當前大限（宮名/stem/startYear/endYear/mutagens）",
          "minorLimitPalace":         "當年小限所在宮位",
          "flowYearLifePalace":       "流年命宮（覆寫 iztro 預設值）",
          "tripleStemOverlap":        "三干疊加偵測（生年干＝來因宮干＝大限干時觸發）",
          "luJiConflicts":            "動態祿忌交戰（含大限/流年來源）",
        },
      },
      {
        path:    "/api/flow?level=hour",
        method:  "GET",
        purpose: "逐時辰分析：六干疊加評分（三派加權）、方位建議、四化因果鏈明細",
        params: {
          required: {
            date:       "YYYY-MM-DD",
            time:       "HH:MM",
            gender:     "男|女",
            level:      "hour",
            targetDate: "YYYY-MM-DD（查詢日期）",
          },
        },
        example: "/api/flow?date=2000-01-01&time=06:00&gender=男&level=hour&targetDate=2026-06-14&_t=20260614",
        keyOutputFields: {
          "hours[]":                        "12 個時辰陣列",
          "hours[].ganZhi":                 "流時干支（如：己巳）",
          "hours[].mingPalaceName":         "流時命宮宮名",
          "hours[].grade":                  "評等（大吉/吉/平/小凶/凶）",
          "hours[].symbol":                 "★★★ / ★★ / ★ / ☆ / ☆☆",
          "hours[].score":                  "數值分數（三派加權）",
          "hours[].factors":                "評分因素清單（如：流年武曲忌-3）",
          "hours[].directions":             "{ 吉方, 貴人方, 財位方, 避凶方 }",
          "hours[].mutagens6layers":        "六層天干各自四化明細",
          "hours[].mutagens6layers[層].化忌": "{ star, landsPalace, hitsMinPalace, hitsTriad }",
          "summary.bestHour":               "今日最佳時辰地支",
          "summary.worstHour":              "今日最差時辰地支",
          "flowDay.mingPalaceName":         "流日命宮宮名",
          "flowMonth.mingPalaceName":       "流月命宮宮名",
        },
        scoringMethod: {
          三合派: "30% — 流時命宮主星亮度 + 三方四正吉煞星",
          占驗派: "50% — 六層天干（生年/大限/流年/流月/流日/流時）四化落命宮",
          飛星派: "20% — 流時宮干自化 + 飛化入命財官遷",
        },
      },
      {
        path:    "/api/synastry",
        method:  "GET",
        purpose: "合盤分析（兩人命盤交叉）",
        params: {
          required: {
            date1: "YYYY-MM-DD", time1: "HH:MM", gender1: "男|女",
            date2: "YYYY-MM-DD", time2: "HH:MM", gender2: "男|女",
          },
        },
        example: "/api/synastry?date1=2000-01-01&time1=06:00&gender1=男&date2=1995-05-20&time2=14:00&gender2=女&_t=20260614",
      },
    ],
  });
};
