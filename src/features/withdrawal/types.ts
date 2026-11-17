/** Account lifecycle port; the preview adapter deletes only its in-memory account. */
export interface WithdrawalActions {
  withdraw(signal: AbortSignal): Promise<void>;
}
