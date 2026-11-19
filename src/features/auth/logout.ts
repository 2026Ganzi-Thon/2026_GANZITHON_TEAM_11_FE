/** Session lifecycle port. Signing out preserves the account's confirmed records. */
export interface LogoutActions {
  logout(signal: AbortSignal): Promise<void>;
}
