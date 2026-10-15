import { addDaysWall, jstWallNow, parseToJstWall, wallKey, wallToDisplay, wallToIso } from '../time.js';
import {
  DATA_NOTICE,
  errorResult,
  textResult,
  truncateMemo,
  type ToolDef,
} from './types.js';

const DEFAULT_RANGE_DAYS = 14;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const DATE_HELP =
  'ISO 8601 の日付または日時 (例: 2026-10-20 / 2026-10-20T10:00 / 2026-10-20T10:00:00+09:00)。' +
  'オフセットを省略した場合は日本時間(JST)として扱う。';

interface AgendaItem {
  id: string;
  type: 'task' | 'event';
  title: string;
  deadline?: string;
  start?: string;
  end?: string;
  memo?: string;
  repeat_type: string;
  color: string | null;
  overdue?: boolean;
  /** Sort key: DB wall-clock string. */
  _sort: string;
  _display: string;
}

function intArg(value: unknown, name: string, min: number, max: number): number | string {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    return `${name} は ${min}〜${max} の整数で指定してください。`;
  }
  return value;
}

export const listAgenda: ToolDef = {
  name: 'list_agenda',
  title: 'タスクと予定の一覧',
  description:
    '指定期間のタスクと予定を時系列で返す。期限が過ぎた未完了タスクも「overdue」として含める。' +
    '期間を省略すると、現在から14日間。',
  scope: 'read',
  annotations: { readOnlyHint: true, openWorldHint: false },
  inputSchema: {
    type: 'object',
    properties: {
      from: { type: 'string', description: `期間の開始。${DATE_HELP} 省略時は現在。` },
      to: {
        type: 'string',
        description: `期間の終了。${DATE_HELP} 日付のみの場合はその日の終わりまで。省略時は開始の14日後。`,
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: MAX_LIMIT,
        description: `最大件数。省略時は ${DEFAULT_LIMIT}。`,
      },
    },
    additionalProperties: false,
  },
  async run(args, ctx) {
    const fromWall =
      args.from === undefined ? jstWallNow(ctx.now()) : parseToJstWall(String(args.from));
    if (!fromWall) return errorResult(`from の形式が不正です。${DATE_HELP}`);

    const toWall =
      args.to === undefined
        ? addDaysWall(fromWall, DEFAULT_RANGE_DAYS)
        : parseToJstWall(String(args.to), { endOfDay: true });
    if (!toWall) return errorResult(`to の形式が不正です。${DATE_HELP}`);
    if (toWall < fromWall) return errorResult('to は from より後にしてください。');

    let limit = DEFAULT_LIMIT;
    if (args.limit !== undefined) {
      const l = intArg(args.limit, 'limit', 1, MAX_LIMIT);
      if (typeof l === 'string') return errorResult(l);
      limit = l;
    }

    // Fetch one row more than `limit` from each table so truncation is detectable
    // after the two lists are merged.
    const [[tasks], [events]] = await Promise.all([
      ctx.db.query<any[]>(
        `SELECT id, title, deadline, repeat_type, color FROM tasks
         WHERE user_id = ? AND is_completed = FALSE AND deadline <= ?
         ORDER BY deadline ASC LIMIT ?`,
        [ctx.userId, toWall, limit + 1]
      ),
      ctx.db.query<any[]>(
        `SELECT id, title, start_dt, end_dt, memo, repeat_type, color FROM events
         WHERE user_id = ? AND start_dt <= ? AND end_dt >= ?
         ORDER BY start_dt ASC LIMIT ?`,
        [ctx.userId, toWall, fromWall, limit + 1]
      ),
    ]);

    const items: AgendaItem[] = [
      ...tasks.map((t): AgendaItem => {
        const display = wallToDisplay(t.deadline);
        return {
          id: t.id,
          type: 'task',
          title: t.title,
          deadline: wallToIso(t.deadline),
          repeat_type: t.repeat_type,
          color: t.color ?? null,
          ...(wallKey(t.deadline) < fromWall ? { overdue: true } : {}),
          _sort: display,
          _display: display,
        };
      }),
      ...events.map((e): AgendaItem => ({
        id: e.id,
        type: 'event',
        title: e.title,
        start: wallToIso(e.start_dt),
        end: wallToIso(e.end_dt),
        memo: truncateMemo(e.memo),
        repeat_type: e.repeat_type,
        color: e.color ?? null,
        _sort: wallToDisplay(e.start_dt),
        _display: `${wallToDisplay(e.start_dt)}〜${wallToDisplay(e.end_dt)}`,
      })),
    ].sort((a, b) => (a._sort < b._sort ? -1 : a._sort > b._sort ? 1 : 0));

    const truncated = items.length > limit;
    const page = items.slice(0, limit);

    const lines = page.map((i) => {
      const label = i.type === 'task' ? (i.overdue ? 'タスク/期限切れ' : 'タスク') : '予定';
      const memo = i.memo ? ` メモ: ${i.memo.replace(/\s+/g, ' ')}` : '';
      return `- [${label}] ${i._display} ${i.title} (id: ${i.id})${memo}`;
    });
    const header = `${wallToDisplay(fromWall)} 〜 ${wallToDisplay(toWall)} (JST) の ${page.length} 件${truncated ? ' (上限により以降は省略)' : ''}`;
    const text = [DATA_NOTICE, header, ...(lines.length ? lines : ['(該当なし)'])].join('\n');

    return textResult(text, {
      from: wallToIso(fromWall),
      to: wallToIso(toWall),
      truncated,
      items: page.map(({ _sort, _display, ...rest }) => rest),
    });
  },
};

export const getItem: ToolDef = {
  name: 'get_item',
  title: 'タスク・予定を1件取得',
  description: 'ID を指定して、タスクまたは予定を1件取得する。',
  scope: 'read',
  annotations: { readOnlyHint: true, openWorldHint: false },
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'list_agenda などで得た ID。' } },
    required: ['id'],
    additionalProperties: false,
  },
  async run(args, ctx) {
    if (typeof args.id !== 'string' || !args.id.trim()) {
      return errorResult('id は必須です。list_agenda で ID を確認してください。');
    }
    const id = args.id.trim();

    const [taskRows] = await ctx.db.query<any[]>(
      'SELECT id, title, deadline, repeat_type, color FROM tasks WHERE id = ? AND user_id = ?',
      [id, ctx.userId]
    );
    if (taskRows[0]) {
      const t = taskRows[0];
      const item = {
        id: t.id,
        type: 'task' as const,
        title: t.title,
        deadline: wallToIso(t.deadline),
        repeat_type: t.repeat_type,
        color: t.color ?? null,
      };
      return textResult(
        `${DATA_NOTICE}\n[タスク] ${wallToDisplay(t.deadline)} ${t.title} (id: ${t.id}, 繰り返し: ${t.repeat_type})`,
        item
      );
    }

    const [eventRows] = await ctx.db.query<any[]>(
      'SELECT id, title, start_dt, end_dt, memo, repeat_type, color FROM events WHERE id = ? AND user_id = ?',
      [id, ctx.userId]
    );
    if (eventRows[0]) {
      const e = eventRows[0];
      const item = {
        id: e.id,
        type: 'event' as const,
        title: e.title,
        start: wallToIso(e.start_dt),
        end: wallToIso(e.end_dt),
        memo: truncateMemo(e.memo),
        repeat_type: e.repeat_type,
        color: e.color ?? null,
      };
      const memo = item.memo ? `\nメモ: ${item.memo}` : '';
      return textResult(
        `${DATA_NOTICE}\n[予定] ${wallToDisplay(e.start_dt)}〜${wallToDisplay(e.end_dt)} ${e.title} (id: ${e.id}, 繰り返し: ${e.repeat_type})${memo}`,
        item
      );
    }

    return errorResult('その ID のタスク・予定は見つかりませんでした。完了・削除済みの可能性があります。');
  },
};
