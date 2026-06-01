# CM Merlin — on-disk editor fields

Offsets follow CM0102Patcher `SaveChanger/Structures.cs` unless noted. Editing requires an **uncompressed** `index.dat` / save.

## Club bank balance (`TClub.Cash`) — VERIFIED

`club.dat` rows are **581 bytes**; bank balance is a **plain signed `int32` in pounds at byte 101** (negative = in debt). There is **no** packed "CM2 long" encoding and **no** ×1000 scale.

Verified against a real save: Barcelona £102,000,000, Real Madrid £100,000,000, Blackburn Rovers £72,000,000, Man Utd £30,400,000; 287 clubs read negative (debt) and none exceed £2bn. Read = `readInt32LE(base+101)`, write = `writeInt32LE(pounds, base+101)`, clamped to ±£2,000,000,000 (vanilla overflow without the EnsureCashDoesNotResetToZero patch). See `src/main/database/clubCashPatch.ts`.

## Player unhappiness / morale

CM 01/02 stores unsettled-player state in several places (same areas the GK Save Game Editor clears under **Contract → Unhappiness**):

| Field | File | Offset | Action in “Clear unhappiness” |
|-------|------|--------|-------------------------------|
| `morale` (`PlayerMorale`) | `player.dat` | 69 (`i8`) | Set to **20** (Superb) |
| `club_valuation` (`ClubValuation`) | `staff.dat` | 0x60 (`u8`) | Set to **20** (maximum) |
| Issue flags (`Unknown18_1` / `Unknown18_2`) | `contract.dat` | 54–69 (16 bytes) | Zeroed — squad depth, rotation, unfair treatment, lost confidence in manager, etc. |
| `Unknown18_3` / `Unknown18_4` | `contract.dat` | 70–72 | **Preserved** — often mirrors squad/shirt number; do not zero |
| Transfer request flag | `contract.dat` | `transfer_status` byte 78, **bit 0x08** | Cleared (`transfer_status & ~8`) |
| Disliked clubs / staff | `Preferences.dat` | 52-byte rows; dislikes @ 16–24 and 40–48 | Set to **−1** (clears “dislikes assistant manager”, etc.) |
| `squad_status` | `contract.dat` | 79 | Reset to **2** (First team) when byte was an invalid value (&gt; 8) |

Squad shirt numbers live on `player.dat` byte 4 (`squad_number`), not in the contract issue block.

`transfer_status` other bits (CM Scout parity):

- `0x01` — listed by club  
- `0x02` — listed for loan  
- `0x08` — transfer listed by player request  

Morale remains editable as a normal attribute in the player editor.

## Current injury (`injury_history.tmp`)

Active injuries live in `injury_history.tmp` (36-byte rows; staff id at byte 0, injury type id at byte 12 — 0 = fit). Merlin reads the **newest** sibling archive (`.sav` vs `index.dat`) so the editor matches what CM last wrote.

| Action | File | Effect |
|--------|------|--------|
| Clear injury (player editor) | `injury_history.tmp` | Sets injury type id to **0** for the player’s active row |

Lookup tries `staff.dat` id, linked `player.dat` id, and staff array index. Save writes a **new copy** — load that file in CM (and reload in Merlin) to apply.

**Important:** Save writes a **new copy** of the file. Load that edited save in CM (and reload it in Merlin) to see changes in-game.

The **Club editor** has **Clear all squad unhappiness on save** — same actions as above for every player-linked staff member at the selected club (employed players plus anyone in `club.dat` squad / team-selected slots, not only the names shown in Merlin’s squad table).

## Staff / non-player (`nonplayer.dat`, 68 bytes)

Linked via `staff.dat` `non_player_id` (row index). Writable coaching/tactics/business fields: see `src/main/database/nonplayerDiskLayout.ts`.

Managing directors and chairmen use `staff.job_for_club === 2` (Managing director) or `1` (Chairman). Board hidden attrs on `nonplayer.dat`: **Business**, **Interference**, **Patience**, **Resources** (sugar daddy — raw byte 1–20).

## Contract (`contract.dat`, 80-byte rows)

Row keyed by `staffIndex` at byte 0. Writable scalars: see `src/main/database/contractDiskLayout.ts`.

| Field | Offset | Notes |
|-------|--------|--------|
| `date_started` | 37 (8-byte TCMDate) | Contract start — player editor date picker |
| `contract_expires` | 45 (8-byte TCMDate) | Contract end — player editor date picker |

Bonuses at **−1** (or 0) display as **None** in CM. Release-clause bytes are Yes/No checkboxes.
