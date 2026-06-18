import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';

const MODEL = 'Xenova/multilingual-e5-small';
export const EMBEDDING_DIM = 384;

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

function getExtractor(): Promise<FeatureExtractionPipeline> {
  extractorPromise ??= pipeline('feature-extraction', MODEL);
  return extractorPromise;
}

export async function embed(
  texts: string[],
  kind: 'query' | 'passage',
): Promise<number[][]> {
  const extractor = await getExtractor();
  const inputs = texts.map((t) => `${kind}: ${t}`);
  const output = await extractor(inputs, { pooling: 'mean', normalize: true });
  return output.tolist() as number[][];
}

export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}
