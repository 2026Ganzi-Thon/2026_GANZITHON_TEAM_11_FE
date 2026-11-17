import type { PasswordResetActions } from '../auth/passwordReset/model';
import type { LoginRequest } from '../../api/contracts';
import type { BirthDateResult } from '../birthDate/types';
import type { ConsentId, ConsentDocuments } from '../legal/model';
export {
  consentIds,
  type ConsentId,
  type ConsentDocument,
  type ConsentDocuments,
} from '../legal/model';
export type Choices = Record<ConsentId, boolean>;
export interface Registration {
  id: string;
  email: string;
}
/** UI ports only. Extra consent fields and registration recovery are not HTTP contracts. */
export interface SignupActions {
  passwordReset: PasswordResetActions;
  today: string;
  loadDocuments(signal: AbortSignal): Promise<ConsentDocuments>;
  register(
    operationKey: string,
    credentials: LoginRequest,
    signal: AbortSignal,
  ): Promise<Registration>;
  consent(
    registrationId: string,
    input: { revision: string; choices: Choices },
    signal: AbortSignal,
  ): Promise<void>;
  birth(
    registrationId: string,
    date: string,
    signal: AbortSignal,
  ): Promise<BirthDateResult>;
  login(credentials: LoginRequest, signal: AbortSignal): Promise<void>;
}
