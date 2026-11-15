import type { LoginRequest } from '../../api/contracts';
import type { BirthDateResult } from '../birthDate/types';
export const consentIds = [
  'terms',
  'privacy',
  'processing',
  'notifications',
] as const;
export type ConsentId = (typeof consentIds)[number];
export type Choices = Record<ConsentId, boolean>;
export interface ConsentDocument {
  id: ConsentId;
  title: string;
  version: string;
  body: string;
}
export interface ConsentDocuments {
  revision: string;
  documents: ConsentDocument[];
}
export interface Registration {
  id: string;
  email: string;
}
/** UI ports only. Extra consent fields and registration recovery are not HTTP contracts. */
export interface SignupActions {
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
