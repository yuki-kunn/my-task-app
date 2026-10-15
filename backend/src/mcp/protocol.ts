export const MODERN_VERSION = '2026-07-28';
export const LEGACY_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'] as const;
export const SUPPORTED_VERSIONS: readonly string[] = [MODERN_VERSION, ...LEGACY_VERSIONS];

export const ErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  HeaderMismatch: -32020,
  UnsupportedProtocolVersion: -32022,
} as const;

export type JsonRpcId = string | number;

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

export interface HttpResult {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export function rpcError(
  id: JsonRpcId | null,
  code: number,
  message: string,
  data?: unknown
): unknown {
  return { jsonrpc: '2.0', id, error: { code, message, ...(data === undefined ? {} : { data }) } };
}

export function rpcResult(id: JsonRpcId, result: unknown): unknown {
  return { jsonrpc: '2.0', id, result };
}

/**
 * Decodes a header value that may use the `=?base64?...?=` sentinel the spec
 * defines for values that are not plain ASCII. Returns null when the sentinel
 * is present but malformed.
 */
export function decodeHeaderValue(value: string): string | null {
  const m = /^=\?base64\?(.*)\?=$/.exec(value);
  if (!m) return value;
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(m[1])) return null;
  return Buffer.from(m[1], 'base64').toString('utf8');
}
