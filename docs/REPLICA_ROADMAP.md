# CM Merlin → CM Scout–class replica

Goal: **same behaviour as classic CM Scout / CM Scout Intrinsic** (data, filters, profile logic), with a **new Electron + React UI**. Extra features ship only after this baseline is solid.

The original **CM Scout** (Windows) is closed source. The closest **open, line-by-line reference** the community has is **CMScout Intrinsic** (author vfilatov; community tree below). CM Merlin already follows its **`index.dat`** layout and CA/in-match math in spirit; finishing “all of CM Scout” means **porting behaviour from that codebase** (and secondarily **CM0102Patcher** structures), not guessing.

## Upstream codebases (clone and diff against)

```bash
git clone --depth 1 https://github.com/MScientistCM/CMScoutIntrinsicCommunity.git
git clone --depth 1 https://github.com/nckstwrt/CM0102Patcher.git
# Optional: broader CM0102 tooling (check license before copying)
git clone --depth 1 https://github.com/agevak/CM0102.git
```

### CMScoutIntrinsicCommunity (primary porting source)

| Area | File(s) | What to replicate in TS |
|------|---------|-------------------------|
| Block archive + RLE | `Sources/Model/CMBinaryReader.cs` | Already mirrored in `src/main/database/cmBinaryReader.ts` — keep in lockstep when fixing bugs. |
| Load + parse | `Sources/Model/DataService.cs` | `CMBlock` directory; `player.dat` (70-byte rows); `staff.dat` (110-byte); names 60-byte rows; `contract.dat`; nations/clubs parsing loops. |
| Staff/player join | Same file (`CMStaff`, `CMPlayer`) | Row inclusion rules, age from DOB, contract linking, loan contracts. |
| CA18 + intrinsic + in-match | `DataService.cs` (`Attribute`, `AttributeValue`, `Attributes` array ~560+) | Port attribute list order, `IsCA18`, `IsLessBetter`, and each formula into `attributes.ts` / `profilePayload.ts`. |
| Filters | `Sources/ViewModel/FiltersViewModel.cs` + `Filter` class in `DataService.cs` | Saved filter tabs, nation groups, divisions, age/value/wage ranges, contract flags, side/position toggles, per-attribute min sliders, favourites flag. |
| Compare | `Sources/ViewModel/ComparePlayersViewModel.cs`, `View/ComparePlayersPage.xaml.cs` | Side-by-side profile columns. |
| Ratings / weights | `RatingsCalculationViewModel.cs`, `WeightsViewModel.cs` | Weighted score columns if CM Scout Intrinsic exposes them in grid. |
| Settings / MRU | `SettingsService.cs`, `LoadViewModel.cs` | Persist last paths, filter sets (map to `electron-store` or JSON file). |

README in that repo states **vfilatov allowed community development**; treat attribution respectfully and keep a short credit in **README** / this doc. There is no SPDX license file in the repo—before large copy-paste, confirm project policy (MIT here vs upstream).

### CM0102Patcher

- `SaveChanger` / structures for **byte-accurate** record layouts when Intrinsic and game disagree.
- Use when validating offsets (e.g. `contract.dat`, `general.dat` date).

### agevak/CM0102 (“TrueCMScout”)

- UX ideas (tabs, benchmarks); **license** must be checked before borrowing code.

## Phased parity (suggested order)

1. **P0 — Core data (mostly done)**  
   Single `index.dat` load; compressed + uncompressed; player grid; basic filters; profile CA18 / other / staff mental; contract snippet when present.

2. **P1 — Filter engine**  
   Implement `Filter` parity from `DataService.cs` / `FiltersViewModel.cs`: age, value, wage, division, nation *groups*, contract states, transfer listed / loan listed, side + position matrices, attribute minima, saved named filters + ordering.

3. **P2 — Grid columns**  
   Every column CM Scout Intrinsic shows on main grid (hidden attributes, EU flag if derived, etc.) — driven from same `Attributes` metadata table after port.

4. **P3 — Favourites + compare**  
   Favourites list; compare 2–N players with same attribute rows as profile.

5. **P4 — Ratings**  
   Optional weighted ratings from saved weight sets (Intrinsic feature).

6. **P5 — Polish**  
   Column chooser, CSV export, keyboard shortcuts, MRU paths.

## “Exact replica” honesty

- **Binary identical** to the old Windows `.exe` is neither possible nor desirable (different UI stack).
- **Behaviourally equivalent** for scouting (same inputs → same rows, filters, and numeric displays) **is** achievable by **systematically porting** the references above into TypeScript and locking them with **fixture `index.dat` slices** and golden outputs.

## Next engineering task (concrete)

- **Done in-tree:** DOB-based age (staff TCM date), contract TCM dates + Bosman byte + release-clause bytes, fixed `transfer_status` / `squad_status` offsets on `contract.dat`, EU passport filter via `nation.dat` `GroupMembership == 2` (matches community loaders), “expires within N months” vs loaded game date.
- **Planned:** Profile/grid toggle to emphasise **engine raw** attributes (already in payload as `raw` for CA18) vs capped in-game 1–20 display — see JSDoc on `attributes.ts`.

Pick **one** slice from `Filter` (e.g. division / side / position) → add to IPC `get-rows` filter object → wire React controls → add a unit test comparing count to a known save. Repeat until `Filter` fields are exhausted.
