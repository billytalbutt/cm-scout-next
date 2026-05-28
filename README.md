# CM Merlin

**Repository:** [github.com/billytalbutt/cm-scout-next](https://github.com/billytalbutt/cm-scout-next)

Cross-platform **Electron + React + TypeScript** scout and editor for **Championship Manager 01/02** `index.dat` (Windows and macOS).

**Product goal:** **CM Scout–equivalent behaviour** (load database, player grid, filters, profile, compare, ratings—same data rules as the classic tools) with a **modern UI**, plus Merlin-specific features (effectiveness rating, regen tracking, tactics lab, editors). See **[docs/REPLICA_ROADMAP.md](docs/REPLICA_ROADMAP.md)** for the phased porting plan.

## Getting started

Open **`index.dat`** or a **`.sav`** from your CM0102 `Game` folder (or Starter Kit). The grid stays empty until a database loads. Attribute filters accept **above 20** (e.g. tackling **22**) to match uncapped CA18 / raw bytes on disk.

## Features

- **Load Database** — `index.dat` uncompressed or compressed (RLE aligned with CM Scout Intrinsic).
- **Player grid** — sortable columns, column chooser, CM Scout %, Effectiveness %, elite engine badges.
- **Filters** — name, nation, club, CA/PA, age, value, wage, contract/transfer, 48 attribute mins, engine sniffer presets, position filters, current-season stats, regen filter.
- **Profile** — CA18 display, hidden attributes, CM Scout % by role, Effectiveness % with recipe breakdown, season stats, contract/transfer, pop-out window.
- **Regens** — GPF2-style snapshot baseline, dedicated Regens tab, development tracking vs snapshot.
- **Shortlists** — per-save lists, `.pls` export for CM Search, staff JSON export.
- **Tactics lab** — pitch layout, squad assignment, community presets, lineup effectiveness.
- **Clubs** — browse, favourites, club editor (finances, stadium, training).
- **Staff** — browse, filters, profiles with non-player coaching attributes.
- **Editor** — player attributes, staff/non-player coaching, club finances, contract/transfer (uncompressed saves; save copy).
- **Compare** — side-by-side two players with attribute winners and category analytics.
- **Knowledge base** — engine reference (Merlin).

Data layout and attribute math follow **CM0102Patcher** and **CMScoutIntrinsicCommunity** `DataService.cs`.

## Run locally

```bash
cd cm-scout-next
npm install
npm start
```

`npm install` runs a production build automatically (`postinstall`). **`npm start` rebuilds then launches**.

Use `npm run dev` for hot-reload while developing.

Use **Load Database** and pick **`index.dat`** (often `…/Game/Data/index.dat` in the Starter Kit).

## Pack installers

```bash
npm run dist:win   # Windows (NSIS)
npm run dist:mac   # macOS
```

## Roadmap

See **[docs/REPLICA_ROADMAP.md](docs/REPLICA_ROADMAP.md)** for remaining CM Scout parity items.

## Legal

This tool only reads files you already have from your own CM 01/02 installation. It does not ship game data. Upstream **CMScoutIntrinsic** source is used as a **behavioural reference**; see [MScientistCM/CMScoutIntrinsicCommunity](https://github.com/MScientistCM/CMScoutIntrinsicCommunity).
