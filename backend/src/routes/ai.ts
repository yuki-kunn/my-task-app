import { Hono } from 'hono';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { pool } from '../db.js';

type Variables = { userId: string; userRole: string };
const router = new Hono<{ Variables: Variables }>();

const AI_DAILY_LIMIT = parseInt(process.env.AI_DAILY_LIMIT ?? '5', 10);
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function jstDateString(): string {
  return new Date(Date.now() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

router.get('/usage', async (c) => {
  const userId = c.get('userId') as string;
  const userRole = c.get('userRole') as string;
  if (userRole === 'admin') {
    return c.json({ used: null, limit: null });
  }
  const today = jstDateString();
  const [[row]] = await pool.query<any[]>(
    `SELECT count FROM ai_usage WHERE user_id = ? AND used_date = ?`,
    [userId, today]
  );
  return c.json({ used: row?.count ?? 0, limit: AI_DAILY_LIMIT });
});

router.post('/parse', async (c) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return c.json({ success: false, message: 'GEMINI_API_KEY が設定されていません' }, 500);
  }
  const userId = c.get('userId') as string;
  const userRole = c.get('userRole') as string;

  // 管理者はレート制限なし
  if (userRole !== 'admin') {
    const today = jstDateString();
    const [[row]] = await pool.query<any[]>(
      `SELECT count FROM ai_usage WHERE user_id = ? AND used_date = ?`,
      [userId, today]
    );
    const currentCount = row?.count ?? 0;
    if (currentCount >= AI_DAILY_LIMIT) {
      return c.json({
        success: false,
        message: `本日のAI利用上限（${AI_DAILY_LIMIT}回）に達しました。明日また試してください。`,
        limitReached: true,
        limit: AI_DAILY_LIMIT,
        used: currentCount,
      }, 429);
    }
  }

  const { text, mode } = await c.req.json<{ text: string; mode: 'simple' | 'organize' }>();
  if (!text?.trim()) {
    return c.json({ success: false, message: 'テキストを入力してください' }, 400);
  }
  const INPUT_LIMIT = mode === 'organize' ? 500 : 200;
  if (text.length > INPUT_LIMIT) {
    return c.json({
      success: false,
      message: `入力が長すぎます（${text.length}文字）。${INPUT_LIMIT}文字以内にしてください。`,
    }, 400);
  }
  const nowJst = new Date(Date.now() + JST_OFFSET_MS).toISOString().slice(0, 16).replace('T', ' ');
  const systemPrompt = mode === 'organize'
    ? `あなたはタスク・予定管理AIです。ユーザーの入力から複数のタスクまたは予定を抽出し、整理してJSON配列で返してください。
現在の日時（JST）: ${nowJst}
各アイテムは以下の形式で返すこと:
[{"type":"task"|"event","title":"...","deadline":"YYYY-MM-DDTHH:MM"(task),"start_dt":"..."(event),"end_dt":"..."(event),"memo":"...","repeat_type":"none"|"daily"|"weekly"|"yearly"}]
日時が不明な場合は合理的に推測すること。必ずJSON配列のみ返すこと。`
    : `あなたはタスク・予定管理AIです。ユーザーの入力から1つのタスクまたは予定を抽出してJSON形式で返してください。
現在の日時（JST）: ${nowJst}
以下の形式で返すこと:
{"type":"task"|"event","title":"...","deadline":"YYYY-MM-DDTHH:MM"(task),"start_dt":"..."(event),"end_dt":"..."(event),"memo":"...","repeat_type":"none"|"daily"|"weekly"|"yearly"}
必ずJSONオブジェクトのみ返すこと。`;
  const prompt = `${systemPrompt}\n\nユーザー入力: ${text}`;
  const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];
  const genai = new GoogleGenerativeAI(apiKey);
  let lastErr: unknown;
  for (const modelName of models) {
    try {
      const model = genai.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const raw = result.response.text().trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      // 成功時にカウント増加（管理者は除く）
      if (userRole !== 'admin') {
        const today = jstDateString();
        await pool.query(
          `INSERT INTO ai_usage (user_id, used_date, count) VALUES (?, ?, 1)
           ON DUPLICATE KEY UPDATE count = count + 1`,
          [userId, today]
        );
      }
      const [[usageRow]] = userRole !== 'admin'
        ? await pool.query<any[]>(`SELECT count FROM ai_usage WHERE user_id = ? AND used_date = ?`, [userId, jstDateString()])
        : [[{ count: null }]];
      return c.json({
        success: true,
        items,
        used: usageRow?.count ?? null,
        limit: userRole !== 'admin' ? AI_DAILY_LIMIT : null,
      });
    } catch (err: any) {
      lastErr = err;
      if (err?.status === 503) {
        console.warn(`${modelName} 503、次のモデルを試みます`);
        continue;
      }
      break;
    }
  }
  console.error('Gemini parse error:', lastErr);
  const is503 = (lastErr as any)?.status === 503;
  return c.json(
    { success: false, message: is503 ? 'AIが混雑しています。しばらくしてから再試行してください。' : 'AI解析に失敗しました' },
    is503 ? 503 : 500
  );
});

export default router;
