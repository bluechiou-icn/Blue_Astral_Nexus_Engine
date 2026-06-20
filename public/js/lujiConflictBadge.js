// Copyright (c) 2026 Blue.X. All Rights Reserved.
// 祿忌交戰金色閃爍徽章 overlay（Sprint 4 v4.1 F2）
//
// 規格：docs/sprints/20260619_Sprint4_Spec_v4.1_LJ_conflict_upgrade.md §一
//   - 位置：宮格外側（上緣外推，不蓋宮位內容）
//   - 配色：金底 #d4af37 / 金深框 #b8941f / 紅字 #dc2626（CSS .luji-badge）
//   - 動畫：1.5s/cycle opacity 0.6↔1.0（CSS @keyframes luji-flash）
//   - 內容：祿忌交戰 Lv.N（N = 該宮最高 severityLevel 1-6）
//   - 互動：hover / click → 完整 tooltip（lujiConflictTooltip.js）
//
// 座標數學沿用 app.js flashPalaceOutline：scale = rect.width/BASE，
// document-absolute（含 scrollX/Y）→ 捲動不破位，resize 由本模組重定位。
//
// classic script，全域 renderLuJiBadges(canvas, luJiByPalace)。
"use strict";

(function () {
  var LAYER_ID = "luji-badge-layer";
  // canvasId → { getCanvas, map } ，供 resize 重繪
  var _registry = {};

  function ensureLayer() {
    var layer = document.getElementById(LAYER_ID);
    if (!layer) {
      layer = document.createElement("div");
      layer.id = LAYER_ID;
      // 容器本身不攔截事件；徽章各自 pointer-events:auto
      layer.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;z-index:8200;";
      document.body.appendChild(layer);
    }
    return layer;
  }

  // 清掉某 canvas 既有徽章（per-canvas 命名，雙年盤不互相清掉）
  function clearBadgesFor(canvasId) {
    var layer = document.getElementById(LAYER_ID);
    if (!layer) return;
    var olds = layer.querySelectorAll('[data-canvas="' + cssEscape(canvasId) + '"]');
    for (var i = 0; i < olds.length; i++) olds[i].remove();
  }

  function cssEscape(s) { return String(s).replace(/"/g, '\\"'); }

  function renderLuJiBadges(canvas, luJiByPalace) {
    if (!canvas || typeof BRANCH_POS === "undefined" || typeof CELL === "undefined" || typeof BASE === "undefined") return;
    var canvasId = canvas.id || "chart-canvas";
    _registry[canvasId] = { getCanvas: function () { return document.getElementById(canvasId); }, map: luJiByPalace };

    var layer = ensureLayer();
    clearBadgesFor(canvasId);
    if (!luJiByPalace) return;

    var rect = canvas.getBoundingClientRect();
    if (!rect.width) return; // 未顯示
    var scale = rect.width / BASE;
    var cell = CELL * scale;

    Object.keys(luJiByPalace).forEach(function (palaceName) {
      var slot = luJiByPalace[palaceName];
      if (!slot || !slot.maxLevel || !slot.branch) return;
      var pos = BRANCH_POS[slot.branch];
      if (!pos) return;
      var row = pos[0], col = pos[1];

      var badge = document.createElement("div");
      badge.className = "luji-badge";
      badge.setAttribute("data-canvas", canvasId);
      badge.textContent = "祿忌交戰 Lv." + slot.maxLevel;
      // 上緣外側、水平置中：垂直跨上邊框（半在格外）
      // 先附上量寬，再定位
      badge.style.position = "absolute";
      badge.style.pointerEvents = "auto";
      badge.style.left = "-9999px";
      layer.appendChild(badge);

      var bw = badge.offsetWidth || 78;
      var bh = badge.offsetHeight || 16;
      var left = rect.left + window.scrollX + col * cell + (cell - bw) / 2;
      var top = rect.top + window.scrollY + row * cell - bh / 2;
      badge.style.left = Math.round(left) + "px";
      badge.style.top = Math.round(top) + "px";

      var conflicts = slot.conflicts || [];
      badge.addEventListener("mouseenter", function (e) {
        if (typeof showLuJiTooltipAt === "function") showLuJiTooltipAt(conflicts, e.clientX, e.clientY);
      });
      badge.addEventListener("mousemove", function (e) {
        if (typeof showLuJiTooltipAt === "function") showLuJiTooltipAt(conflicts, e.clientX, e.clientY);
      });
      badge.addEventListener("mouseleave", function () {
        if (typeof hideLuJiTooltip === "function") hideLuJiTooltip();
      });
      // mobile：點擊 toggle
      badge.addEventListener("click", function (e) {
        e.stopPropagation();
        var box = document.getElementById("luji-tooltip-box");
        var open = box && box.style.display === "block";
        if (open) { if (typeof hideLuJiTooltip === "function") hideLuJiTooltip(); }
        else if (typeof showLuJiTooltipAt === "function") showLuJiTooltipAt(conflicts, e.clientX, e.clientY);
      });
    });
  }

  // resize：重定位所有已註冊 canvas 的徽章（debounce）
  var _rzTimer = null;
  window.addEventListener("resize", function () {
    if (_rzTimer) clearTimeout(_rzTimer);
    _rzTimer = setTimeout(function () {
      Object.keys(_registry).forEach(function (id) {
        var entry = _registry[id];
        var cv = entry.getCanvas && entry.getCanvas();
        if (cv) renderLuJiBadges(cv, entry.map);
      });
    }, 150);
  });

  // 點空白處關閉 tooltip（mobile click 後）
  document.addEventListener("click", function (e) {
    if (e.target && e.target.classList && e.target.classList.contains("luji-badge")) return;
    if (typeof hideLuJiTooltip === "function") hideLuJiTooltip();
  });

  window.renderLuJiBadges = renderLuJiBadges;
})();
