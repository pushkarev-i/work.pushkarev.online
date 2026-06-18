import { pool } from './db.js';
import { embed, toVectorLiteral } from './embeddings.js';

export async function retrieve(question: string, k = 4): Promise<string[]> {
  const [qv] = await embed([question], 'query');
  const { rows } = await pool.query<{ content: string }>(
    'SELECT content FROM documents ORDER BY embedding <=> $1 LIMIT $2',
    [toVectorLiteral(qv), k],
  );
  return rows.map((r) => r.content);
}
