import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool, initDb } from './db.js';
import { embed, toVectorLiteral } from './embeddings.js';

const KNOWLEDGE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'knowledge');

function chunk(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 30);
}

async function loadChunks(): Promise<string[]> {
  const files = (await readdir(KNOWLEDGE_DIR)).filter((f) => f.endsWith('.md'));
  const all: string[] = [];
  for (const file of files) {
    const text = await readFile(join(KNOWLEDGE_DIR, file), 'utf8');
    all.push(...chunk(text));
  }
  return all;
}

export async function ingestAll(): Promise<number> {
  await initDb();
  const chunks = await loadChunks();
  if (chunks.length === 0) return 0;

  const vectors = await embed(chunks, 'passage');

  await pool.query('TRUNCATE documents RESTART IDENTITY');
  for (let i = 0; i < chunks.length; i++) {
    await pool.query('INSERT INTO documents (content, embedding) VALUES ($1, $2)', [
      chunks[i],
      toVectorLiteral(vectors[i]),
    ]);
  }
  return chunks.length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  ingestAll()
    .then((n) => {
      console.log(`Ingested ${n} chunks`);
      return pool.end();
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
