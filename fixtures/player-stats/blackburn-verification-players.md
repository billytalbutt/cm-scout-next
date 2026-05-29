# Blackburn verification players (uncompressed save)

Use these `player.dat` row ids when comparing CM in-game stats to CM Merlin.

| Player | player.dat id | staff.dat id | Notes |
|--------|---------------|--------------|--------|
| Kieron Dyer | **118** | 152 | Grid rows; apps/assists often correct on plausible rows |
| Joe Cole | **5451** | 6408 | Off-grid id anchors → same research table columns as Dyer |
| Xavi | **14922** | 17483 | Off-grid id anchors |
| Maxim Tsigalko | **27755** | 33263 | Off-grid id anchors when stats present |

All listed players were at **Blackburn Rovers** with division comp id **7** (Premier League in this save) on the research save.

**Profile UI (research mode):** the per-competition table lists every decoded grid row (labels are often wrong). The “Save file (est.)” line uses heuristic v1 only. Cole / Xavi / Tsigalko usually show a **Heuristic v1** table row if the blob scan finds them.

Verify with:

```bash
npm run research:player-stats-diff -- path/to/your.sav
npx tsx scripts/verify-blackburn-player-stats.ts path/to/your.sav
```
