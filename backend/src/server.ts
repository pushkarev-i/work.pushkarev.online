import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { ChatOpenAI } from '@langchain/openai';
import { initDb, countDocuments } from './db.js';
import { ingestAll } from './ingest.js';
import { retrieve } from './rag.js';

const PORT = Number(process.env.PORT ?? 3100);
const MAX_MESSAGE_LEN = 1000;
const MIN_MESSAGE_LEN = 5;

const SYSTEM_PROMPT = `Ты — ассистент на онлайн-резюме Ильи, инженера по ИИ-интеграциям и автоматизации.
Отвечай на вопросы работодателей о его опыте и навыках — кратко, по делу, на русском.
Когда упоминаешь владельца резюме, используй только имя: Илья (без фамилии).
Используй ТОЛЬКО приведённый контекст. Если в контексте нет ответа — честно скажи,
что этой информации в резюме нет, и предложи связаться напрямую (ilia@pushkarev.online).
Не выдумывай факты.`;

const llm = new ChatOpenAI({
  model: process.env.LLM_MODEL ?? 'openrouter/auto',
  apiKey: process.env.OPENROUTER_API_KEY,
  temperature: 0.2,
  maxTokens: 600,
  configuration: {
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.SITE_URL ?? '',
      'X-Title': 'Ilia Pushkarev - resume',
    },
  },
  modelKwargs: {
    max_price: { input: '0', output: '0' },
  },
});

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: (process.env.CORS_ORIGIN ?? '*').split(',').map((s) => s.trim()),
});
await app.register(rateLimit, { max: 20, timeWindow: '1 minute' });

app.get('/health', async () => ({ ok: true }));

app.post<{ Body: { message?: unknown } }>(
  '/chat',
  { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
  async (req, reply) => {
  const { message } = req.body ?? {};
  if (typeof message !== 'string' || message.trim().length < MIN_MESSAGE_LEN) {
    return reply.code(400).send({ error: 'message too short' });
  }
  if (message.length > MAX_MESSAGE_LEN) {
    return reply.code(400).send({ error: 'message too long' });
  }

  const naughty = /хуй|письк|пизд|ёбан|ебан|залуп|член|мудак|шлюх|сиськ|жопа|жоп[уы]/i;
  if (naughty.test(message)) return { answer: '𓂺' };

  const context = await retrieve(message);
  const res = await llm.invoke([
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Контекст из резюме:\n${context.join('\n---\n')}\n\nВопрос: ${message}`,
    },
  ]);

  return { answer: res.content };
},
);

await initDb();
if ((await countDocuments()) === 0) {
  app.log.info('Knowledge index empty — running ingest...');
  const n = await ingestAll();
  app.log.info(`Ingested ${n} chunks`);
}

await app.listen({ host: '0.0.0.0', port: PORT });
