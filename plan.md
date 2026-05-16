# CM Scout Next — roadmap / deferred work

## In-save editor (Graeme Kelly–class, inside this app)

**Goal:** Safe, scoped editing of CM0102 **uncompressed** saves (names where feasible, positions, attributes, morale) without the full surface area of legacy GK Save Game Editor until validated.

**References (community / open layouts):**

- Graeme Kelly **GK Save Game Editor** v4.0 / Nick+Co v4.1 — [champman0102.net thread](https://champman0102.net/viewtopic.php?p=13974) (uncompressed saves, temp `.dat` buffer until Save, `cm0102.exe` path for some contract/finance paths).
- Nick **CM0102Patcher** — `SaveChanger/Structures.cs` and related repos for save-oriented structs.
- **CMExplorer** and forum **Save Game Editor Queries** FAQ — workflows (compression off, backup, validation).

**Technical approach (this codebase):**

- `parseIndexDat` / block directory already mirror the same **block archive** the game uses; `parser.ts` has fixed row sizes (e.g. player 70 bytes, staff 110 bytes).
- **Write path:** load full file → locate blocks → patch only whitelisted offsets → write **copy** of `.sav` (never in-place without backup) → optional consistency checks as research matures.
- **Constraints:** uncompressed (or explicit decompress/recompress with tests); never write while CM holds the file; clamp values; name edits likely via **name table IDs** before arbitrary string rewrites.

**Milestone 1:** Prove round-trip — patch one byte (e.g. morale) on one player, new file loads in CM.

---

## Other notes

- `player stats.dat`: **spec + grid V0 field map (Phase C)** — `playerStatsFields.ts` decodes 128 B rows (apps/goals/assists + experimental rating/defensive bytes), fills profile per-competition table; heuristic v1 fallback; optional env golden (`fixtures/player-stats/README.md`). Confirm rating/tackles against CM UI before calling exact.
- `scripts/try-parse-sav.ts` was left empty; remove or implement if needed.
