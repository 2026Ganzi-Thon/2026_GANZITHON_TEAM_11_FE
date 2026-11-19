import {
  PREVIEW_LEGAL_REVISION,
  previewDocumentTitles,
  previewDocumentBodies,
} from '../features/legal/previewPolicy';
import { ApiError } from '../api/errors';
import {
  legalDocumentIds,
  type ConsentDocuments,
  type LegalDocumentActions,
} from '../features/legal/model';
export type LegalDocumentsScenario = 'success' | 'retry' | 'slow' | 'long';
/** Independent snapshots for signup and read-only settings views. */
export function exampleLegalDocuments(
  revision = PREVIEW_LEGAL_REVISION,
): ConsentDocuments {
  return {
    revision,
    documents: legalDocumentIds.map((id) => ({
      id,
      title: previewDocumentTitles[id],
      version: revision,
      body: previewDocumentBodies[id],
    })),
  };
}
export function createMockLegalDocuments(
  scenario: LegalDocumentsScenario = 'success',
): LegalDocumentActions {
  let failed = false;
  return {
    load: (signal) =>
      new Promise((resolve, reject) => {
        if (signal.aborted) {
          reject(new ApiError('aborted'));
          return;
        }
        const abort = () => {
          clearTimeout(timer);
          signal.removeEventListener('abort', abort);
          reject(new ApiError('aborted'));
        };
        const timer = setTimeout(
          () => {
            signal.removeEventListener('abort', abort);
            if (scenario === 'retry' && !failed) {
              failed = true;
              reject(new ApiError('network'));
              return;
            }
            resolve(exampleLegalDocuments());
          },
          scenario === 'slow' ? 5000 : 500,
        );
        signal.addEventListener('abort', abort, { once: true });
      }),
  };
}
