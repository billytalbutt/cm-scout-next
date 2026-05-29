# Player stats discovery workflow

Use the **discovery tool** to find where CM0102 stores appearances, goals, assists, and average rating before changing Merlin’s profile UI or production decoder.

## Quick start

```bash
cd cm-merlin
npm run discover:player-stats -- "C:/Users/bitalb/Downloads/Blackburn Uncompressed.sav"
```

Or set `CM0102_GOLDEN_SAV` and run without a path:

```bash
set CM0102_GOLDEN_SAV=C:\path\to\Your Save.sav
npm run discover:player-stats
```

### Options

| Flag | Purpose |
|------|---------|
| `--names "A,B"` | Resolve players by display name (default: Blackburn verification four) |
| `--ids 118,5451` | Resolve by `player.dat` row id |
| `--json path.json` | Full candidate list with provenance |
| `--expect "apps=12,goals=3,assists=1,rating=7.1"` | Highlight rows matching CM UI numbers |

Example with golden numbers from CM:

```bash
npm run discover:player-stats -- your.sav --names "Kieron Dyer" --expect "apps=10,goals=2,assists=1,rating=7.00" --json out/dyer.json
```

## Compare with CM in-game

1. Load the **same** uncompressed `.sav` in CM0102.
2. Open a player → **Stats** → **Senior club** (combined league + cups).
3. Note **Apps**, **Goals**, **Assists**, **Av. rating** (and per-competition if needed).
4. Run the discovery tool with `--expect` using those exact numbers.
5. In the console, check **EXPECT MATCHES** — note `source`, `offset`, `rowStart`, and `field` for each match.
6. Confirm on a **second save** after one match (e.g. `npm run research:stats-windows`) so bytes move with stats.

## Blackburn verification players

| Player | player.dat id | staff.dat id |
|--------|---------------|--------------|
| Kieron Dyer | 118 | 152 |
| Joe Cole | 5451 | 6408 |
| Xavi | 14922 | 17483 |
| Maxim Tsigalko | 27755 | 33263 |

See also [blackburn-verification-players.md](./blackburn-verification-players.md).

## Data sources the tool scans

| Source | What you get | Limits |
|--------|----------------|--------|
| `staff_history.dat` | Apps/goals per club per year | No assists or av. rating |
| `staff.dat` | International caps (`int_apps` / `int_goals`) | Not club season stats |
| `player stats.dat` | Grid V0 rows, id anchors, Senior-club totals (embedded/off-grid) | Per-comp rows unreliable on 128 B grid |
| **`player stats history.tmp`** | **Best lead for per-competition stats** | Row size **47 B (0x2f)** per CM0102Patcher `SaveReader.cs` |

### Per-competition stats (May 2026 probe)

Run:

```bash
npm run probe:player-comp-pairs -- your.sav
```

This scans for **`player.dat` id + `club_comp` id** (Premier **7**, FA Cup **351**, League Cup **352**, Champions **326**, etc.) in the same byte window.

**Blackburn save findings:**

| Player | `player stats history.tmp` + comp **7** | `player stats.dat` |
|--------|----------------------------------------|-------------------|
| Kieron Dyer | Yes (e.g. row @1071036, player@+20, comp@+8 in 47 B stride) | Many window hits (noisy — id 118) |
| **Joe Cole** | **Yes — 6 co-occurrences with Premier League id 7** | Off-grid anchor only |
| Xavi | No hits yet | Single id hit |
| Tsigalko | No hits yet | Off-grid anchor only |

**Conclusion:** CM likely stores **per-competition** appearance/goals (and related bytes) in **`player stats history.tmp`**, not in the 128-byte `player stats.dat` grid we were scanning. Senior-club combined totals still look like `player stats.dat` (summary/embedded records).

**Exe / source lineage (for full parity):** CM3-era `comp_stats.CPP` and `player_stats.cpp` (see CM0102Patcher debug symbol lists). Community “hide all stats” patch NOPs **0x570e5–0x57193** in `cm0102.exe` — that region is the in-game stats UI path. Decompiling is optional once `player stats history.tmp` row layout is confirmed with your CM UI numbers.

Optional: set `CM0102_EXE` to your game executable for future string/xref work (not required for save-only probing).

## Related scripts

- `npm run dump:player-stats-rows` — shorter Senior-club focused dump
- `npm run research:player-stats-layout` — stride/header scan
- `npm run research:player-stats-phase-b` — competition id correlation

Spec: [docs/PLAYER_STATS_DECODING_SPEC.md](../../docs/PLAYER_STATS_DECODING_SPEC.md)

## After you find a match

1. Record `rowStart`, field offsets, and decoder in the spec doc.
2. Add a golden vector or env integration test (`CM0102_GOLDEN_SAV` + `CM0102_GOLDEN_JSON`).
3. Only then update Merlin production (`CM_SCOUT_PLAYER_STATS_PARSE=summary`).

## Merlin production (wired)

- **Scope rows:** `player.dat` id @ +0, apps/goals/assists @ +4/+5/+6, scope u8 @ +12.
- **Per-competition rows:** same stats when `club_comp` id @ +8 resolves (47-byte stride also scanned with player@+20).
- **Grid filters:** pick competition from save’s `club_comp.dat` list, then min/max goals, assists, or apps.
