/**
 * CM0102 `contract.dat` contract-type byte categories (CM Scout / CM0102Loader parity).
 * Bytes use high bit for part-time; exact ranges from community tooling.
 */

export type ContractTypeCategoryId =
  | 'invalid'
  | 'ft_monthly'
  | 'ft'
  | 'na'
  | 'ft_trial'
  | 'ft_loan'
  | 'pt_monthly'
  | 'pt'
  | 'pt_trial'
  | 'pt_loan'

/** Representative contract-type bytes for the editor (GK Save Game Editor parity). */
export const CONTRACT_TYPE_EDITOR_OPTIONS: ReadonlyArray<{ byte: number; label: string }> = [
  { byte: 0x01, label: 'Full time — monthly' },
  { byte: 0x02, label: 'Full time — standard' },
  { byte: 0x05, label: 'Full time — trial' },
  { byte: 0x06, label: 'Full time — loan' },
  { byte: 0x07, label: 'Full time — loan (alt)' },
  { byte: 0x81, label: 'Part time — monthly' },
  { byte: 0x82, label: 'Part time — standard' },
  { byte: 0x85, label: 'Part time — trial' },
  { byte: 0x86, label: 'Part time — loan' },
]

/** Squad-status bytes for contract editor dropdown (`contract.dat` byte 79). */
export const SQUAD_STATUS_EDITOR_OPTIONS: ReadonlyArray<{ byte: number; label: string }> = [
  { byte: 0, label: 'Not set' },
  { byte: 1, label: 'Key player' },
  { byte: 2, label: 'First team' },
  { byte: 3, label: 'Squad player' },
  { byte: 4, label: 'Future prospect' },
  { byte: 5, label: 'Hot prospect' },
  { byte: 6, label: 'Youngster' },
  { byte: 7, label: 'Not wanted' },
  { byte: 8, label: 'On loan' },
]

export const CONTRACT_TYPE_FILTER_OPTIONS: ReadonlyArray<{
  id: '' | ContractTypeCategoryId
  label: string
}> = [
  { id: '', label: 'Any contract type' },
  { id: 'invalid', label: 'Invalid / empty slot' },
  { id: 'ft_monthly', label: 'Full time — monthly' },
  { id: 'ft', label: 'Full time — standard' },
  { id: 'na', label: 'N/A (unused)' },
  { id: 'ft_trial', label: 'Full time — trial' },
  { id: 'ft_loan', label: 'Full time — loan' },
  { id: 'pt_monthly', label: 'Part time — monthly' },
  { id: 'pt', label: 'Part time — standard' },
  { id: 'pt_trial', label: 'Part time — trial' },
  { id: 'pt_loan', label: 'Part time — loan' },
]

const MATCHERS: Record<ContractTypeCategoryId, (type: number) => boolean> = {
  invalid: (type) => type === 0x00 || type === 0x40 || type === 0x80 || type === 0xc0,
  ft_monthly: (type) => type === 0x01 || type === 0x41,
  ft: (type) =>
    type === 0x02 ||
    type === 0x42 ||
    (type >= 0x08 && type <= 0x3f) ||
    (type >= 0x48 && type <= 0x7f),
  na: (type) =>
    type === 0x03 ||
    type === 0x04 ||
    type === 0x43 ||
    type === 0x44 ||
    type === 0x83 ||
    type === 0x84 ||
    type === 0xc3 ||
    type === 0xc4,
  ft_trial: (type) => type === 0x05 || type === 0x45,
  ft_loan: (type) => type === 0x06 || type === 0x07 || type === 0x46 || type === 0x47,
  pt_monthly: (type) => type === 0x81 || type === 0xc1,
  pt: (type) =>
    type === 0x82 ||
    type === 0xc2 ||
    (type >= 0x88 && type <= 0xbf) ||
    (type >= 0xc8 && type <= 0xff),
  pt_trial: (type) => type === 0x85 || type === 0xc5,
  pt_loan: (type) => type === 0x86 || type === 0x87 || type === 0xc6 || type === 0xc7,
}

export function contractTypeMatchesCategory(
  contractTypeByte: number,
  categoryId: ContractTypeCategoryId,
): boolean {
  return MATCHERS[categoryId](contractTypeByte)
}

/** First matching category label for display (grid / profile). */
export function contractTypeLabel(contractTypeByte: number): string {
  for (const opt of CONTRACT_TYPE_FILTER_OPTIONS) {
    if (!opt.id) continue
    if (contractTypeMatchesCategory(contractTypeByte, opt.id)) return opt.label
  }
  return `Unknown (0x${contractTypeByte.toString(16).padStart(2, '0')})`
}
