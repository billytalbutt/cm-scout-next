# Golden fixtures for `player stats.dat`

## Synthetic (committed)

Built in code in `playerStatsDat.test.ts`, `playerStatsLayout.test.ts`, `playerStatsJoins.test.ts`, and `playerStatsFields.test.ts` — no binary files required. These assert heuristic v1, Phase A/B helpers, and grid V0 field map decode.

## Optional full-save golden (not committed)

For integration tests that compare against **Championship Manager’s own UI** (or a trusted extractor):

1. Create a JSON file mapping `player.dat` row id → `{ apps, goals, assists, averageRating?, ... }` for players you verified in-game on that save. Optional `perCompetition` array per player for the profile table.
2. Set environment variables when running tests locally or in CI:

```bash
set CM0102_GOLDEN_SAV=C:\path\to\verified.sav
set CM0102_GOLDEN_JSON=C:\path\to\expected-from-cm-ui.json
npm test
```

3. Do **not** commit `.sav` files or large extracts unless you have rights to redistribute them.

The integration test file is `src/main/database/playerStatsGolden.integration.test.ts` and skips when env vars are unset.

Phase A: `npm run research:player-stats-layout -- <path-to.sav>`. Phase B: `npm run research:player-stats-phase-b -- <path-to.sav>` (see `docs/PLAYER_STATS_DECODING_SPEC.md`).
