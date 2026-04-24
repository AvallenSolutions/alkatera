export interface UpgradeResult {
  /** Null when the upgrade form does not persist a separate activity entry (e.g. SupplyChain). */
  entryId: string | null
  entryTable: string | null
  xeroTransactionIds: string[]
}

export interface UpgradeFormCommonProps {
  onComplete: (result: UpgradeResult) => void
  onCancel: () => void
}
