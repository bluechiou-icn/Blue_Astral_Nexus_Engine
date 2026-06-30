# Astral Nexus Engine — Agent Onboarding
**知識文件政策（2026-05-27 起）：知識文件僅存 Google Drive，不納入 git 版本控制。**

## Quick orientation

- **Project:** ÆTHNOUS Astral Nexus Engine — 紫微斗數排盤 API
- **Stack:** Node.js 20, iztro ^2.5.8, Vercel serverless
- **Core file:** `chart-api.js` — Blue's Version 完整邏輯（四化、亮度、小限、歲前星）
- **API endpoints:**
  - `GET /api/chart?date=YYYY-MM-DD&time=HH:MM&gender=男|女` — 本命盤（含 classicalFormations）
  - `GET /api/flow?date=YYYY-MM-DD&time=HH:MM&gender=男|女&year=YYYY` — 流年盤
  - `GET /chart.html` — 命盤視覺化（Canvas，三盤疊盤，PNG 匯出）
- **Production:** https://blue-astral-nexus-engine.vercel.app
- **GitHub:** https://github.com/bluechiou-icn/Blue_Astral_Nexus_Engine
- **Deploy:** `git push origin main` → `npx vercel --prod` → 手動清除 Vercel CDN Cache

## Critical notes

- **Cache-Control:** 必須保持 `no-store, no-cache, must-revalidate, proxy-revalidate` + `Surrogate-Control: no-store`。嚴禁回退。
- **secrets / API keys：** 使用 Vercel Environment Variables，不可 hardcode。
- **個人生日資料：** 嚴禁進入 git。example 參數使用 `2000-01-01 06:00`。
- **知識文件：** `ClaudeCode_*.md`, `CLAUDE_Code_*.md` 已加入 .gitignore，請到 Google Drive 查閱。

## API response key fields

`/api/chart` — `classicalFormations[]`（2026-05-30 新增）：
```json
{ "name": "格局名", "type": "auspicious|challenge|neutral",
  "palaces": [...], "stars": [...], "note": "...", "confidence": 0-100 }
```
偵測格局：命宮借星、身宮星組、文星群聚、財宮化忌、紫府朝垣、羊陀夾忌、空劫坐命、祿馬交馳

## Knowledge doc version history（Google Drive 版本，僅供參考）

| Date | File | Summary |
|------|------|---------|
| 2026-05-30 (2) | `ClaudeCode_20260530_2.md` | classicalFormations API（8格局偵測）＋ chart.html UI 升級 7項 |
| 2026-05-30 | `ClaudeCode_20260530.md` | 命盤視覺化 Phase 1（Canvas 4×4、三盤疊盤、流年導航、PNG 匯出） |
| 2026-05-27 | `ClaudeCode_20260527.md` | 水二局起點修正、RWD、Security cleanup、flow.js 修正 |
| 2026-05-22 (morning) | `ClaudeCode_20260522_morning.md` | 多語言切換、Blue.X 署名、翻譯表 |
| 2026-05-21 (2) | `CLAUDE_Code_20260521_2.md` | BLUE_SI_HUA_TABLE、八等級亮度、庚干Bug、STAR_META |
| 2026-05-21 | `CLAUDE_Code_20260521.md` | 借對宮欄位、assertions、GitHub sync |
| 2026-05-20 | `CLAUDE_Code_20260520.md` | Initial full doc: API upgrade |
