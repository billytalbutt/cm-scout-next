# CM Scout Next

**Repository:** [github.com/billytalbutt/cm-scout-next](https://github.com/billytalbutt/cm-scout-next)

Cross-platform **Electron + React + TypeScript** scout for **Championship Manager 01/02** `index.dat` (Windows and macOS).

## Demo player (no save required)

**Maxim Tsigalko** is always injected as the first list row (tagged **Demo**) with typical wonderkid striker stats so you can **click the row** to preview the profile panel before opening any `index.dat`. He is not read from your game files.

After you load a real database, Maxim stays at the top of the list (until filters hide him).

## Features (milestone 1)

- Load **`index.dat`** — **uncompressed** or **compressed** (same RLE reader as CM Scout Intrinsic’s `CMBinaryReader`).
- **Player grid** with sortable columns (name, nation, club, CA, PA, wage, value).
- **Filters**: name search, nation, club, CA/PA min/max.
- **Profile panel**: CA18 attributes with **in-game** (CM Scout formula), **raw intrinsic**, **in-match**; physical/other attributes; staff “hidden” mental fields from `staff.dat`; **contract** summary when linked.
- **Colour hints** on attribute numbers (high = green, low = red; inverted for injury proneness & dirtiness).

Data layout and attribute math follow **CM0102Patcher** `SaveChanger/Structures.cs` and **CMScoutIntrinsicCommunity** `DataService.cs`.

## Run locally

```bash
cd cm-scout-next
npm install
npm run dev
```

Use **Open index.dat** and pick your game file (usually `…/Championship Manager 01-02/Data/index.dat` or from an uncompressed save folder).

## Pack installers

```bash
npm run dist:win   # Windows (NSIS)
npm run dist:mac   # macOS (requires signing/notarisation for distribution)
```

## Roadmap (your requested extras)

- Deeper **CM Scout filter parity** (contract types, EU, position filters, saved filters).
- **Season stats / competition breakdown** (needs correct `staff_history` / competition tables wiring).
- **Role templates** (striker / midfielder / defender / GK) with highlight tiers for “key / backup / fluff” attributes on the profile.
- Polish: fonts, animations, column chooser, export CSV.

## Legal

This tool only reads files you already have from your own CM 01/02 installation. It does not ship game data.
