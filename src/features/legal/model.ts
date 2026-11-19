export const legalDocumentIds = [
  'terms',
  'privacy',
  'processing',
  'notifications',
] as const;
export type LegalDocumentId = (typeof legalDocumentIds)[number];
export const consentIds = ['terms', 'privacy', 'notifications'] as const;
export type ConsentId = (typeof consentIds)[number];
export const requiredConsentIds = ['terms', 'privacy'] as const;
export function hasRequiredConsents(
  choices: Readonly<Partial<Record<ConsentId, boolean>>>,
) {
  return requiredConsentIds.every((id) => choices[id] === true);
}
export interface ConsentDocument {
  id: LegalDocumentId;
  title: string;
  version: string;
  body: string;
}
export interface ConsentDocuments {
  revision: string;
  documents: ConsentDocument[];
}
export interface LegalDocumentActions {
  load(signal: AbortSignal): Promise<ConsentDocuments>;
}
export function validDocuments(value: unknown): value is ConsentDocuments {
  if (!value || typeof value !== 'object') return false;
  const d = value as ConsentDocuments;
  return (
    typeof d.revision === 'string' &&
    !!d.revision.trim() &&
    Array.isArray(d.documents) &&
    d.documents.length === legalDocumentIds.length &&
    legalDocumentIds.every(
      (id) =>
        d.documents.filter(
          (doc) =>
            doc &&
            doc.id === id &&
            [doc.title, doc.body, doc.version].every(
              (v) => typeof v === 'string' && !!v.trim(),
            ),
        ).length === 1,
    )
  );
}
