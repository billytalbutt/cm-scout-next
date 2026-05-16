# `player stats.dat` — source-of-truth decoding spec

This document defines **what “correct” means**, how we get there from today’s **heuristic v1** decoder, and how **golden tests** lock behaviour so refactors do not silently regress.

## Current state (grid V0 + heuristic fallback)

Implementation: `src/main/database/playerStatsFields.ts` (structured **128 B** rows) and `src/main/database/playerStatsDat.ts` (legacy scan/heuristic).

- **Grid V0** walks `player stats.dat` with header **60**, stride **128**, `player.dat` id @ **40**; field map in `PLAYER_STATS_FIELD_MAP_V0` (apps/goals/assists + experimental rating/tackles/pass/headers). Builds **per-competition** rows and a **primary** row (club division comp when known).
- **Heuristic v1** still fills players with no eligible grid row (scan-based `zeroedPrefix` / `chainPrevId` / `default`).
- **Not** fully verified against CM UI for every field; rating/defensive bytes are experimental until env goldens land.

**Heuristic version constant:** `PLAYER_STATS_HEURISTIC_VERSION` (exported from the same module). Bump when offsets or pick logic change; golden vectors must be reviewed.

## Definition of “source of truth”

For a given **loaded save** (same `player stats.dat` bytes CM would read):

1. **Row identity:** For each in-game stats row the UI can show (per player, per competition, per season scope the UI uses), we can compute the same **primary key** the game uses and find **exactly one** record — not “best of N `indexOf` hits”.
2. **Field identity:** Each displayed number (apps, goals, assists, av. rating, etc.) maps to a **fixed offset + type + scale** within that record (or to a derived rule, e.g. `sum_rating / apps`).
3. **Validation:** Parsed values **match the game UI** (same save, same filters) for a **large matrix** of players, clubs, and competitions — automated where possible.

Until all three hold, the decoder is **research-grade** or **heuristic**, not source-of-truth.

## Technical work plan (ordered)

### Phase A — Row set model (blocking)

**Findings (May 2026)** — tooling: `src/main/database/playerStatsLayout.ts`, `npm run research:player-stats-layout`, tests in `playerStatsLayout.test.ts`.

- On a large **Blackburn uncompressed** save (`player stats.dat` ~14.65 MiB, `player.dat` ids dense `0..N-1`), naive "id in playerIds" grid scoring hits **100% false positives**; scoring must also require a plausible int32 at **id+4** (same bands as heuristic v1 in `playerStatsDat.ts`).
- With that filter, a **128-byte stride** dominates the top of the brute-force grid (80-288 B, 4 B steps). The strongest **alignment** signal is **`(len - header) mod 128 = 3`** with **`headerBytes ~ 60`** and **`idOffsetInRow ~ 40`** (~33% of the first 4000 row slots pass id+`+4` test; distinct ids ~727 in that window — not yet one row per player, so multiple row kinds or false positives remain).
- First **256 bytes** (uint32 dump) are non-trivial (not an obvious `count, stride` pair); treat as an opaque header until more saves are compared.

- [x] **Partial:** fixed **128 B row stride** is the leading hypothesis; **~60 B prefix** + **slack 3** tail bytes vs full rows; **player id column ~ offset 40** within the 128 B tile (needs more saves + goldens to confirm).
- [ ] Enumerate **record kinds** (league / cup / aggregate / international / etc.) and how they differ (size, prefix magic, key fields).
- [ ] Replace “scan all `int32` positions for player id” with **structured iteration** once row boundaries and per-kind layouts are confirmed (use `iteratePlayerStatsRowStarts` after goldens agree on header/stride).

**Exit:** Can list all records of type T without scanning unrelated bytes. *(Not met yet — stride hypothesis only.)*

### Phase B — Keys and joins

**Findings (May 2026)** — `src/main/database/playerStatsJoins.ts`, `npm run research:player-stats-phase-b -- <.sav>`, `playerStatsJoins.test.ts`. Grid: `PLAYER_STATS_RESEARCH_GRID_V0` (Phase A): header 60, stride 128, `player.dat` id at row byte **40**.

- **Player join key:** **`player.dat` row id** at `rowStart + 40` (int32 LE). **`staff.dat` id** is not a primary inline key: correlating row int32s with the linked `staff.id` peaks around **0.16%** on a Blackburn eligible-row sample.
- **Many rows per player:** Eligible rows (id + plausible `+4`) show **thousands of rows for one player** (e.g. max **3613** in ~13.7k rows) vs **~1849** distinct players — the block is **multi-row per player**. `savePerformanceByPlayerDatId` remains a **heuristic aggregate**, not a full row export.
- **Competition-like int32s:** Offsets **0, 4, 8, 72, 96, 104, …** often hold values present in **`club_comp.dat`** id set, but on this save **almost every such hit is also in `staff_comp.dat`** id space (`clubOnly=0` in disambiguation samples; large `both` counts). **Cannot** infer domestic vs international from id membership alone; needs UI goldens or other row fields (Phase C).
- **Season:** Not identified in this pass.

- [x] **Partial:** Join on **`player.dat` id** at grid offset; **`staff.id`** ruled out as main row key.
- [ ] Map **competition** to one int32 column **with UI proof** (overlap issue above).
- [ ] Map **season** (or document row scope vs `general.dat` date only).
- [x] **Partial — UI:** **Now:** one `PlayerSavePerformanceStats` per `player.dat` id (`savePerformance` / `savePerformanceByPlayerDatId`). **Later:** choose either a documented **aggregate rule** over decoded rows or a **per-row** model `(playerDatId, competitionKey, …)`; lock with goldens.

**Exit:** For a random player, locate all rows for that player in the current season without ambiguity. *(Not met — multi-row confirmed; competition column ambiguous.)*

### Phase C — Field map (apps, goals, assists, rating, defensive stats)

**Implementation (May 2026)** — `src/main/database/playerStatsFields.ts`, `PLAYER_STATS_FIELD_MAP_V0`, `parsePlayerStatsFromSave`, tests in `playerStatsFields.test.ts`.

| Field | Row rel | Type | Notes |
|-------|---------|------|--------|
| `competitionId` | 8 | int32 | Phase B candidate; name from `club_comp` / `staff_comp` |
| `goals` | 44 | u8 | Research offset (may be wrong — compare rows in UI) |
| `apps` | 52 | u8 | Heuristic `id+12` on grid |
| `assists` | 53 | u8 | Paired-save +1 (not heuristic `id+106`, which is outside 128 B row) |
| `averageRating` | 76 | u8 ÷ 10 | **Experimental** (10–100 → 6.0–10.0) — needs UI golden |
| `tackles` | 115 | u8 | **Experimental** |
| `headers` | 116 | u8 | **Experimental** |
| `passes` | 117 | u8 | **Experimental** |
| `playerDatId` | 40 | int32 | Join key |

**Production behaviour:**

- **Research UI:** `savePerformancePerCompByPlayerDatId` lists **every** decoded grid row (no dedupe; labels often wrong). `savePerformanceByPlayerDatId` uses **heuristic v1 only** for the summary line (not a picked grid row).
- Heuristic row also appended to the research table when the blob scan finds the player.
- Players with no grid rows may still show a **Heuristic v1** table row (Cole, Xavi, etc. on test saves).

- [x] **Partial:** fixed offsets for core counting stats on grid V0; wired to UI per-comp table.
- [ ] **Average rating / defensive bytes:** offsets assigned; require CM UI goldens before “source of truth”.
- [ ] Golden JSON from in-game UI for pinned players (env integration test).

**Exit:** Golden fixtures pass against **in-game** reference numbers. *(Partial — synthetic + paired-save evidence; full UI golden still optional via env.)*

### Phase D — Production hardening

- [ ] Remove or gate heuristic v1 behind a flag once spec decoder ships.
- [ ] Fuzz / bounds / negative tests on malformed buffers.
- [ ] Optional: compressed-save path (same block after decompress) — align with `CmBinaryReader` in `parser.ts`.

## Golden tests (two layers)

### 1. Synthetic vectors (CI, always on)

Small `Buffer`s in `playerStatsDat.test.ts` assert:

- `detectPlayerStatsRowLayout` + `decodePlayerStatsRowAtAnchor` for each layout class.
- `pickPlayerStatsAnchor` for controlled duplicate-id scenarios.

`playerStatsLayout.test.ts`, `playerStatsJoins.test.ts`, and `playerStatsFields.test.ts` add synthetic vectors for layout scan, joins, and field map decode.

### 2. Optional integration golden (local / CI secret)

- Env: `CM0102_GOLDEN_SAV` = path to a known uncompressed `.sav` (not committed).
- Env: `CM0102_GOLDEN_JSON` = path to expected extract (player id → apps/goals/assists/rating) produced once from CM UI or a trusted tool.

`src/main/database/playerStatsGolden.integration.test.ts` runs only when both are set; skipped otherwise.

See `fixtures/player-stats/README.md`. Phase A: `npm run research:player-stats-layout -- <path>`. Phase B: `npm run research:player-stats-phase-b -- <path>`. Phase C diffs: `npm run research:player-stats-phase-c -- <older> <newer>`.

## References

- `playerStatsFields.ts` / `PLAYER_STATS_FIELD_MAP_V0` — Phase C decode + `parsePlayerStatsFromSave`.
- `playerStatsJoins.ts` / `npm run research:player-stats-phase-b` — Phase B join / competition correlation (offline).
- Community: CM0102Patcher `SaveChanger/Structures.cs`, GK Save Game Editor threads (champman0102.net).
- `scripts/research-player-stats-diff.ts`, `scripts/analyze-stats-windows.ts`, `scripts/analyze-player-stats-layout.ts`, `scripts/research-player-stats-phase-b.ts`.

## Ownership

Treat this file as the **single spec** for save performance decoding. Implementation details live in `playerStatsDat.ts` and tests; high-level contracts and checklist live here.
