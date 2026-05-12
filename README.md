# CM Scout Next

**Repository:** [github.com/billytalbutt/cm-scout-next](https://github.com/billytalbutt/cm-scout-next)

Cross-platform **Electron + React + TypeScript** scout for **Championship Manager 01/02** `index.dat` (Windows and macOS).

**Product goal:** **CM Scout–equivalent behaviour** (load database, player grid, filters, profile, compare, ratings—same data rules as the classic tools) with a **modern UI**, then layer new features. See **[docs/REPLICA_ROADMAP.md](docs/REPLICA_ROADMAP.md)** for the phased porting plan and **which upstream files to translate** (main reference: **CMScoutIntrinsicCommunity** `DataService.cs` + filter/compare viewmodels).

## Demo player (no save required)

**Maxim Tsigalko** is always injected as the first list row (tagged **Demo**) with typical wonderkid striker stats. **Single-click** the row to select it; **double-click** (or **Enter** / **Open profile**) to open the profile panel before loading a database. He is not read from your game files.

After you load a real database, Maxim stays at the top of the list (until filters hide him).

## Features (current milestone)

- **Load Database** — `index.dat` **uncompressed** or **compressed** (RLE reader aligned with CM Scout Intrinsic `CMBinaryReader`).
- **Player grid** — sortable columns (name, nation, club, CA, PA, wage, value).
- **Filters** — name, nation, club, CA/PA min/max (full **CM Scout Intrinsic–style** filter set is tracked in the roadmap).
- **Profile** — CA18 (in-game / intrinsic / in-match), other physical/technical fields, staff mental fields, contract summary when linked.
- **Colour hints** on attribute numbers (high = green, low = red; inverted for injury proneness and dirtiness).

Data layout and attribute math follow **CM0102Patcher** (`SaveChanger` / structures) and **CMScoutIntrinsicCommunity** `DataService.cs`.

## Run locally

```bash
cd cm-scout-next
npm install
npm run dev
```

Use **Load Database** and pick **`index.dat`** (often `…/Game/Data/index.dat` in the Starter Kit, or your install’s `Data` folder).

## Pack installers

```bash
npm run dist:win   # Windows (NSIS)
npm run dist:mac   # macOS (may require signing/notarisation for broad distribution)
```

## Roadmap (after replica baseline)

See **[docs/REPLICA_ROADMAP.md](docs/REPLICA_ROADMAP.md)** for filter/compare/ratings parity and optional extras (season stats, role templates, CSV export, column chooser).

## Legal

This tool only reads files you already have from your own CM 01/02 installation. It does not ship game data. Upstream **CMScoutIntrinsic** source is used as a **behavioural reference**; see the community README on [MScientistCM/CMScoutIntrinsicCommunity](https://github.com/MScientistCM/CMScoutIntrinsicCommunity) for author permission to continue development.
