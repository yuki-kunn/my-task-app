import { Hono } from 'hono';
import { pool } from '../db.js';

type Variables = { userId: string; userRole: string; apiTokenId: string };
const router = new Hono<{ Variables: Variables }>();

type ExportNote = {
  id: string;
  type: 'task' | 'event';
  title: string;
  // Task fields
  deadline?: string;
  is_completed?: boolean;
  // Event fields
  start_dt?: string;
  end_dt?: string;
  memo?: string;
  // Common
  repeat_type: string;
  color: string | null; // resolved hex (e.g. "#6366f1") or a preset key, never "custom:<id>"
  created_at: string;
};

// GET /api/obsidian/export
// Read-only snapshot of the caller's tasks + upcoming events, shaped as one
// object per note. Obsidian-side automation is expected to:
//   1. Upsert a .md file per item (id -> filename, frontmatter from fields).
//   2. Delete/archive any local note whose id is NOT in the returned `ids` list
//      (Tasqa completes/deletes items outright, so this is how removals sync).
router.get('/export', async (c) => {
  const userId = c.get('userId');

  const [[tasks], [events], [userColors]] = await Promise.all([
    pool.query<any[]>(
      `SELECT id, title, deadline, repeat_type, is_completed, color, created_at
       FROM tasks WHERE user_id = ? ORDER BY deadline ASC`,
      [userId]
    ),
    pool.query<any[]>(
      `SELECT id, title, start_dt, end_dt, memo, repeat_type, color, created_at
       FROM events WHERE user_id = ? ORDER BY start_dt ASC`,
      [userId]
    ),
    pool.query<any[]>('SELECT id, hex FROM user_colors WHERE user_id = ?', [userId]),
  ]);

  const hexById = new Map<string, string>(userColors.map((row: any) => [row.id, row.hex]));
  const resolveColor = (color: string | null): string | null => {
    if (!color) return null;
    if (color.startsWith('custom:')) {
      return hexById.get(color.slice(7)) ?? null;
    }
    return color;
  };

  const taskNotes: ExportNote[] = tasks.map((t) => ({
    id: t.id,
    type: 'task',
    title: t.title,
    deadline: toIso(t.deadline),
    is_completed: !!t.is_completed,
    repeat_type: t.repeat_type,
    color: resolveColor(t.color),
    created_at: toIso(t.created_at)!,
  }));

  const eventNotes: ExportNote[] = events.map((e) => ({
    id: e.id,
    type: 'event',
    title: e.title,
    start_dt: toIso(e.start_dt),
    end_dt: toIso(e.end_dt),
    memo: e.memo ?? undefined,
    repeat_type: e.repeat_type,
    color: resolveColor(e.color),
    created_at: toIso(e.created_at)!,
  }));

  const notes = [...taskNotes, ...eventNotes];

  return c.json({
    exportedAt: new Date().toISOString(),
    count: notes.length,
    ids: notes.map((n) => n.id), // full set of currently-existing ids, for delete-sync
    notes,
  });
});

function toIso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(`${value}Z`);
  return d.toISOString();
}

export default router;
