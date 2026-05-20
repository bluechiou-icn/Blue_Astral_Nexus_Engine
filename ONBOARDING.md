# Astral Nexus Engine — Agent Onboarding
**Latest knowledge doc: `CLAUDE_Code_20260520.md` (in this directory)**

This file is the ShareOnboardingGuide entry point.  
For full project context, architecture decisions, References analysis, and pending tasks, read:

→ `CLAUDE_Code_20260520.md`

## Quick orientation

- **Project:** `ziwei-engine` — 紫微斗數排盤 API + 命盤圖片生成器
- **Stack:** Node.js 20, iztro ^2.5.8, @resvg/resvg-js ^2.6.2, Vercel
- **Core file:** `chart-api.js` — 85% completeness as of 2026-05-20
- **API endpoint:** `GET /api/chart?date=YYYY-MM-DD&time=HH:MM&gender=男|女`
- **Test subject:** Blue, YYYY-MM-DD 05:17 男
- **Deploy:** `npx vercel --prod`

## Knowledge doc version history

| Date | File | Summary |
|------|------|---------|
| 2026-05-20 | `CLAUDE_Code_20260520.md` | Initial full doc: API upgrade, image generator V1-V3, References analysis |
