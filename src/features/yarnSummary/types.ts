export interface ReceivedYarnSummary {
  id: string;
  date: string;
  yarn_count: number;
  sender_count: number;
}
/** Projection of API v0.6 GET yarn-summary and bodyless PUT seen. */
export interface ReceivedYarnActions {
  load(signal: AbortSignal): Promise<ReceivedYarnSummary | null>;
  markSeen(summaryId: string, signal: AbortSignal): Promise<void>;
}
