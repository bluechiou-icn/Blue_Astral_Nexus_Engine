# Knowledge Doc — 2026-06-19 Sprint 3.9 hotfix + S4 v4.1 split

**版本**：v1.0
**日期**：2026-06-19 Noon Taipei
**作業者**：Claude (Opus 4.7)
**任務性質**：規格拆分與整理（無 code 改動）

---

## 一、本次任務做了什麼

Blue 提交的 `20260619_Noon_Blue_SprintX_upgrade.md` 包含 12 項需求，性質橫跨「Sprint 3 收尾 hotfix」與「Sprint 4 P2 規格升級」。
為 ADHD-friendly，已執行：

1. ✅ Rename 原檔：`SprintX` → `Sprint3.9_hotfix+S4_spec_update`
2. ✅ 拆出 Sprint 3.9 hotfix spec（給 Cassian）
3. ✅ 拆出 Sprint 4 Spec v4.1（祿忌交戰升級，給 Raziel/Claude Code）
4. ✅ 在 v4.0 spec §三 加 redirect 註記

---

## 二、產出檔案清單

| 檔名 | 用途 | 對象 |
|---|---|---|
| `20260619_Noon_Blue_Sprint3.9_hotfix+S4_spec_update.md` | Blue 原 brain dump（rename 後） | 歷史紀錄 |
| `20260619_Sprint3.9_hotfix_for_Cassian.md` | 8 項 hotfix（H0~H6 + 提醒） | Cassian → Claude Code |
| `20260619_Sprint4_Spec_v4.1_LJ_conflict_upgrade.md` | 祿忌交戰金色閃爍格 + 6 級 | Raziel → Claude Code |
| `ClaudeCode_20260617_4_Sprint4_Spec.md` | v4.0 §三 加 redirect 註記 | 已更新 |

---

## 三、12 項 brain dump → spec 對應表

| brain dump # | 拆到哪 | 任務 ID |
|---|---|---|
| 1, 3 | Sprint 3.9 hotfix | H1（分類欄寬度） |
| 2 | Sprint 3.9 hotfix | H0（生日欄底色 blocker） |
| 4 | Sprint 3.9 hotfix | H6（Drive appData 樹狀） |
| 5 | Sprint 3.9 hotfix | H2（格局/雙干疊加底色） |
| 6 | Sprint 3.9 hotfix（連 Sprint 4 P3） | H3（格局文字 + 配色） |
| 7 | Sprint 3.9 hotfix 提醒 | 格局庫 update（Blue + Cassian） |
| 8 | **Sprint 4 v4.1** | 金色閃爍格 |
| 9 | **Sprint 4 v4.1** | 6 級 severity |
| 10 | **Sprint 4 v4.1** | 完整來源說明 |
| 11 | Sprint 3.9 hotfix | H4（儲存按鍵 + 已儲存命例呈現） |
| 12 | Sprint 3.9 hotfix | H5（合盤入口） |

---

## 四、引擎當前狀態（2026-06-19 Noon）

- **Base commit**：`2e0fcd3` feat: 流月軸 + 宮位星曜排版優化
- **Sprint 進度**：
  - ✅ Sprint 1（核心引擎）
  - ✅ Sprint 2（i18n zh/en/ko 雙語 canvas）
  - ✅ Sprint 3（Google Drive 命例庫）
  - ✅ Sprint 3.8（Cassian 06-17 測試完成的修補版）
  - 🟡 **Sprint 3.9（hotfix，本次新增，待 Cassian 開工）**
  - 🟡 **Sprint 4**（spec v4.0 + v4.1 patch 已 ready，待 Sprint 3.9 完成後開工）

---

## 五、建議的執行次序

```
Sprint 3.9 hotfix (Cassian → Claude Code)
  ├─ H0 生日欄底色 [blocker]
  ├─ H1 分類欄寬度
  ├─ H2 格局/雙干疊加底色
  ├─ H4 儲存命例 + 分類呈現
  ├─ H5 合盤入口（暫導舊 synastry.html）
  ├─ H6 Drive appData 樹狀
  └─ H3 格局文字+配色（建議併入 Sprint 4 P3）

↓ smoke test pass 後

Sprint 4 (Raziel → Claude Code)
  ├─ P0 雙人合盤獨立頁 + 交叉飛化矩陣
  ├─ P1 三干疊加 banner
  ├─ P2 祿忌交戰（依 v4.1 規格：金色閃爍格 + 6 級）
  └─ P3 格局徽章（吸收 H3 規格）
```

---

## 六、上傳清單

### 6.1 Google Drive
**Folder ID**：`1XDqLUHppMpQL3ULta3rg73TE9gVJi7GU`（依 [[reference_google_drive_folders]]，ÆTHNOUS 知識文件夾）

待上傳：
- [ ] `20260619_Noon_Blue_Sprint3.9_hotfix+S4_spec_update.md`
- [ ] `20260619_Sprint3.9_hotfix_for_Cassian.md`
- [ ] `20260619_Sprint4_Spec_v4.1_LJ_conflict_upgrade.md`
- [ ] `ClaudeCode_20260617_4_Sprint4_Spec.md`（更新版，覆寫舊版）
- [ ] `20260619_Knowledge_Doc_Sprint3.9+S4v4.1_split.md`（本檔）

### 6.2 GitHub（ANE repo）
**Repo**：`bluechiou-icn/Blue_Astral_Nexus_Engine`（Astral_Nexus_Engine 目錄為 git 子模組或 fork）

待 commit（建議 commit message）：
```
docs: split 06-19 brain dump into Sprint 3.9 hotfix + S4 v4.1 spec

- Rename SprintX placeholder → Sprint3.9_hotfix+S4_spec_update
- Add 20260619_Sprint3.9_hotfix_for_Cassian.md (8 hotfix items)
- Add 20260619_Sprint4_Spec_v4.1_LJ_conflict_upgrade.md (6-level
  conflict badge + full source tooltip)
- Mark v4.0 spec §三 as superseded with redirect note
- Add knowledge doc index for the split

No code change.
```

> ⚠️ 上傳前請 Blue 確認：這些 .md 是否已在現有 ANE repo 的 git tracking 範圍內？檔案目前在 `/Users/CLAUDE/CLAUDE CODE/07_ASTRAL_NEXUS_ENGINE/` 而 git repo 在 `Astral_Nexus_Engine/` 子目錄；若要進 repo 需先 `cp` 或建立 `docs/` 對應結構。

---

## 七、提醒給未來的 Claude

- 本次拆分**不改任何 code**，純 spec/文件整理
- Sprint 3.9 與 Sprint 4 的引擎側改動清單（E1~E5）需 Raziel 與 Cassian 對齊後再交給 Claude Code
- 祿忌交戰 6 級 mapping 的 Level 3↔4、5↔6 邊界尚未拍板，是 Raziel 下一步必須先收斂的決策點
- 合盤模式下的交叉飛化祿忌交戰（v4.1 §3.3）是新邏輯，非 v4.0 Spec 範圍，務必算進 Sprint 4 LoE
