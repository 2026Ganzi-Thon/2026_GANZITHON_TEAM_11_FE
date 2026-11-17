export const consentIds = [
  'terms',
  'privacy',
  'processing',
  'notifications',
] as const;
export type ConsentId = (typeof consentIds)[number];
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
    d.documents.length === consentIds.length &&
    consentIds.every(
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
