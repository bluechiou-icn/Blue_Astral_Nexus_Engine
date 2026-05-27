# Astral Nexus Engine — Agent Onboarding
**Latest knowledge doc: `ClaudeCode_20260522_morning.md` (in this directory)**

This file is the ShareOnboardingGuide entry point.  
For full project context, architecture decisions, References analysis, and pending tasks, read:

→ `ClaudeCode_20260522_morning.md`

## Quick orientation

- **Project:** `ziwei-engine` — 紫微斗數排盤 API + 命盤圖片生成器
- **Stack:** Node.js 20, iztro ^2.5.8, @resvg/resvg-js ^2.6.2, Vercel
- **Core file:** `chart-api.js` — 借對宮欄位已加入（2026-05-21）
- **API endpoint:** `GET /api/chart?date=YYYY-MM-DD&time=HH:MM&gender=男|女`
- **Production:** https://blue-astral-nexus-engine.vercel.app
- **GitHub:** https://github.com/bluechiou-icn/Blue_Astral_Nexus_Engine
- **Deploy:** `npx vercel --prod` → `git push origin main`

## Knowledge doc version history

| Date | File | Summary |
|------|------|---------|
| 2026-05-22 (morning) | `ClaudeCode_20260522_morning.md` | 中英文語言切換、韓文預留、Blue.X 署名、完整翻譯表 |
| 2026-05-21 (2) | `CLAUDE_Code_20260521_2.md` | BLUE_SI_HUA_TABLE、八等級亮度、庚干Bug修正、STAR_META、UI deploy |
| 2026-05-21 | `CLAUDE_Code_20260521.md` | 借對宮欄位、14/14 assertion tests、GitHub sync、Claude Code 2.1.145 |
| 2026-05-20 | `CLAUDE_Code_20260520.md` | Initial full doc: API upgrade, image generator V1-V3, References analysis |
