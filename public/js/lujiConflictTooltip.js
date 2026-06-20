// Copyright (c) 2026 Blue.X. All Rights Reserved.
// 祿忌交戰完整提示訊息框（Sprint 4 v4.1 F3）
//
// 規格：docs/sprints/20260619_Sprint4_Spec_v4.1_LJ_conflict_upgrade.md §三
// 設計目標（Blue 原話）：「要讓剛加入汎天派的命理師能夠明白」
//   → 禁簡稱、禁內部 enum，所有 layer / star / palace 用人類可讀全名。
//
// 資料來源 = 引擎 lujiConflicts[]（chart-api.js detectLuJiConflict）：
//   { palace, star, luSources:[{src,stem}], jiSources:[{src,stem}],
//     severity, severityLevel(1-6), levelLabel, pattern, note }
//   ⚠ src 為「混合」：時間層('生年'/'大限'/'流年'…) 或 來源宮名(宮干飛化)。
//
// classic script（非 ES module），全域函式，供 chart-render.js + badge 共用。
"use strict";

(function () {
  // 6 級標籤 fallback（引擎正常會帶 levelLabel；缺則用此表）
  var LEVEL_LABELS = { 1: "輕微", 2: "輕度", 3: "中度", 4: "偏重度", 5: "重度", 6: "嚴重度" };
  // 時間層集合（用以區分 src 是「層」還是「來源宮」）
  var LAYER_SET = { "生年": 1, "大限": 1, "流年": 1, "流月": 1, "流日": 1, "流時": 1 };

  // 單一來源 → 人類可讀全名
  //   時間層：  生年（庚干）→ 紫微化祿
  //   宮干飛化：田宅宮（戊干）飛入 → 紫微化祿
  function fmtSource(s, star, mutagenWord) {
    var stemPart = s.stem ? "（" + s.stem + "干）" : "";
    if (LAYER_SET[s.src]) {
      return s.src + stemPart + " → " + star + "化" + mutagenWord;
    }
    // 來源宮：補「宮」字（若尚未帶）
    var pName = /宮$/.test(s.src) ? s.src : s.src + "宮";
    return pName + stemPart + "飛入 → " + star + "化" + mutagenWord;
  }

  // 單條 conflict → 文字區塊
  function fmtConflict(c) {
    var lvl = c.severityLevel || 0;
    var label = c.levelLabel || LEVEL_LABELS[lvl] || "";
    var palace = /宮$/.test(c.palace) ? c.palace : c.palace + "宮";
    var luN = (c.luSources || []).length;
    var jiN = (c.jiSources || []).length;

    var lines = [];
    lines.push("［祿忌交戰　Level " + lvl + "・" + label + "］");
    lines.push(c.star + " 坐 " + palace + "　" + luN + "祿 v.s. " + jiN + "忌");
    if (c.pattern === "luji_chanzhan") {
      lines.push("⚠ 纏戰：祿忌雙方各 ≥2，互不相讓");
    }
    lines.push("──────────────");
    lines.push("祿來源：");
    (c.luSources || []).forEach(function (s) {
      lines.push("  • " + fmtSource(s, c.star, "祿"));
    });
    lines.push("忌來源：");
    (c.jiSources || []).forEach(function (s) {
      lines.push("  • " + fmtSource(s, c.star, "忌"));
    });
    return lines.join("\n");
  }

  // 多條 conflict（同宮多星）→ 完整文字
  function buildLuJiTooltipText(conflicts) {
    if (!conflicts || !conflicts.length) return "";
    return conflicts.map(fmtConflict).join("\n\n");
  }

  // ── 共用 tooltip DOM（badge click/hover 用；hover-on-canvas 走 chart-render 既有 el）──
  var _tipEl = null;
  function ensureTipEl() {
    if (_tipEl) return _tipEl;
    _tipEl = document.createElement("div");
    _tipEl.id = "luji-tooltip-box";
    _tipEl.className = "luji-tooltip-box";
    document.body.appendChild(_tipEl);
    return _tipEl;
  }

  function showLuJiTooltipAt(conflicts, clientX, clientY) {
    var text = buildLuJiTooltipText(conflicts);
    if (!text) return;
    var tip = ensureTipEl();
    tip.textContent = text;
    tip.style.display = "block";
    // 邊緣 clamp
    var vw = window.innerWidth, vh = window.innerHeight;
    var rect = tip.getBoundingClientRect();
    var tx = clientX + 14, ty = clientY + 14;
    if (tx + rect.width > vw) tx = clientX - rect.width - 14;
    if (ty + rect.height > vh) ty = clientY - rect.height - 14;
    tip.style.left = Math.max(8, tx) + "px";
    tip.style.top = Math.max(8, ty) + "px";
  }

  function hideLuJiTooltip() {
    if (_tipEl) _tipEl.style.display = "none";
  }

  // 全域導出（classic script）
  window.buildLuJiTooltipText = buildLuJiTooltipText;
  window.showLuJiTooltipAt = showLuJiTooltipAt;
  window.hideLuJiTooltip = hideLuJiTooltip;
})();
