import { ApiError } from '../api/errors';
import type {
  Reflection,
  ReflectionRecord,
} from '../features/morning/reflection';
export type MockNightRecord = NonNullable<ReflectionRecord['night']> & {
  reflection: Reflection | null;
};
export interface MockWorryRecords {
  get(id: string): MockNightRecord | undefined;
  all(): MockNightRecord[];
  erase(id: string): void;
  eraseRecord(id: string): void;
  isRecordDeleted(id: string): boolean;
  saveReflection(id: string, reflection: Reflection): void;
}
/** Shared memory behind settings, detail and reflection samples. */
export function createMockWorryRecords(
  seed: MockNightRecord[],
): MockWorryRecords {
  const records = new Map(
    seed.map((item) => [
      item.id,
      { ...item, reflection: item.reflection ? { ...item.reflection } : null },
    ]),
  );
  const find = (id: string) => {
    const record = records.get(id);
    if (!record) throw new ApiError('http', { status: 404, code: 'NOT_FOUND' });
    return record;
  };
  const deletedRecords = new Set<string>();
  return {
    get: (id) => records.get(id),
    all: () => [...records.values()],
    erase(id) {
      const record = find(id);
      record.worry_text = null;
      record.worry_saved_at = null;
    },
    eraseRecord(id) {
      const record = find(id);
      record.worry_text = null;
      record.worry_saved_at = null;
      record.reflection = null;
      deletedRecords.add(id);
    },
    isRecordDeleted: (id) => deletedRecords.has(id),
    saveReflection(id, reflection) {
      if (deletedRecords.has(id))
        throw new ApiError('http', {
          status: 409,
          code: 'REFLECTION_NOT_AVAILABLE',
        });
      find(id).reflection = reflection;
    },
  };
}
