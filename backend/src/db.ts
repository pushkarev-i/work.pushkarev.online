import pg from 'pg';
import { EMBEDDING_DIM } from './embeddings.js';

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export async function initDb(): Promise<void> {
  await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      embedding vector(${EMBEDDING_DIM})
    )
  `);
}

export async function countDocuments(): Promise<number> {
  const { rows } = await pool.query<{ count: string }>('SELECT COUNT(*) FROM documents');
  return Number(rows[0].count);
}
