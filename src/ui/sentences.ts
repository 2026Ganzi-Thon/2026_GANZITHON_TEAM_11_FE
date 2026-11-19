/** Presentation only: keep submitted text intact. */
export function sentenceLines(text: string): string {
  return text
    .replace(/([.!?。？！]+[”’"']?)[ \t]+(?=\S)/gu, '$1\n')
    .replace(/([.!?。？！]+[”’"']?)(?=[가-힣])/gu, '$1\n');
}
