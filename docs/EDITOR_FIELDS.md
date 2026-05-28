# CM Merlin — on-disk editor fields

Offsets follow CM0102Patcher `SaveChanger/Structures.cs` unless noted. Editing requires an **uncompressed** `index.dat` / save.

## Player unhappiness / morale

CM 01/02 does not expose a separate `unhappiness` byte in the parsed structures used here. Unsettled players are usually reflected by:

| Field | File | Offset | Action in “Clear unhappiness” |
|-------|------|--------|-------------------------------|
| `morale` | `player.dat` | 69 (`i8`) | Set to **20** (maximum) |
| Transfer request flag | `contract.dat` | `transfer_status` byte 78, **bit 0x08** | Cleared (`transfer_status & ~8`) |

`transfer_status` other bits (CM Scout parity):

- `0x01` — listed by club  
- `0x02` — listed for loan  
- `0x08` — transfer listed by player request  

Morale remains editable as a normal attribute in the player editor.

## Staff / non-player (`nonplayer.dat`, 68 bytes)

Linked via `staff.dat` `non_player_id` (row index). Writable coaching/tactics/business fields: see `src/main/database/nonplayerDiskLayout.ts`.

Managing directors use `staff.job_for_club === 2` (`TStaff.JobForClub`).

## Contract (`contract.dat`, 80-byte rows)

Row keyed by `staffIndex` at byte 0. Writable scalars: see `src/main/database/contractDiskLayout.ts`.

TCM dates (`date_started`, `contract_expires`) are not yet exposed in the UI (bytes 37–52).
