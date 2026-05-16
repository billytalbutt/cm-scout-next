# Blackburn verification players (uncompressed save)

Use these `player.dat` row ids when comparing CM in-game stats to CM Scout Next.

| Player | player.dat id | staff.dat id | Notes |
|--------|---------------|--------------|--------|
| Kieron Dyer | **118** | 152 | Grid rows; apps/assists often correct on plausible rows |
| Joe Cole | **5451** | 6408 | Often heuristic v1 only (no eligible grid row) |
| Xavi | **14922** | 17483 | Often heuristic v1 only |
| Maxim Tsigalko | **27755** | 33263 | Check heuristic / grid coverage |

All listed players were at **Blackburn Rovers** with division comp id **7** (Premier League in this save) on the research save.

Verify with:

```bash
npm run research:player-stats-diff -- path/to/your.sav
npx tsx scripts/verify-blackburn-player-stats.ts path/to/your.sav
```
