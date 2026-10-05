// Supabase Edge Function `api`의 원본. scripts/build-function.mjs가 이 파일을 index.js 하나로 묶는다.
// 화면(GitHub Pages)에서 오는 /api/* 요청을 받아 기존 서버 코드(app/worker.ts의 api)에 넘긴다.
import postgres from 'npm:postgres@3.4.5';
import {api} from '../../../app/worker';
import {PgD1,pgTypes} from '../../../lib/pg-d1';
import {reportError} from '../../../lib/errors';

declare const Deno: {env: {get(name: string): string | undefined}; serve(handler: (req: Request) => Promise<Response> | Response): unknown};
const read = (name: string) => Deno.env.get(name) || undefined;

const sql = postgres(read('SUPABASE_DB_URL')!, {max: 3, prepare: false, types: pgTypes as any, onnotice() {}});
const env = {
  DB: new PgD1(sql as any) as unknown as D1Database,
  SUPABASE_URL: read('SUPABASE_URL'),
  SUPABASE_ANON_KEY: read('SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: read('SUPABASE_SERVICE_ROLE_KEY'),
  HQ_ADMIN_EMAIL: read('HQ_ADMIN_EMAIL'),
  HQ_NATIVE_USER_ID: read('HQ_NATIVE_USER_ID'),
  RESEND_API_KEY: read('RESEND_API_KEY'),
  EMAIL_FROM: read('EMAIL_FROM'),
  VAPID_PUBLIC_KEY: read('VAPID_PUBLIC_KEY'),
  VAPID_PRIVATE_KEY: read('VAPID_PRIVATE_KEY'),
  VAPID_SUBJECT: read('VAPID_SUBJECT'),
  NTS_API_KEY: read('NTS_API_KEY'),
};
// 허용할 화면 주소. 여러 개면 쉼표로 구분하고, 첫 번째가 메일 링크 등에 쓰는 대표 주소다.
const origins = (read('APP_ORIGIN') || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const allowed = origin && origins.includes(origin) ? origin : null;
  const cors: Record<string, string> = {
    'Access-Control-Allow-Origin': allowed || origins[0] || '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Expose-Headers': 'content-disposition',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers: cors});
  if (origin && !allowed) return Response.json({error: '허용되지 않은 화면에서 온 요청이에요.'}, {status: 403, headers: cors});

  const url = new URL(req.url);
  let path = url.pathname.replace(/^\/functions\/v1/, '');
  if (!path.startsWith('/api')) path = '/api' + path;
  // 기존 코드는 "요청 주소의 출처 == Origin 헤더"로 위조 요청을 막는다. 화면 주소를 요청 주소로 삼아 그 검사를 그대로 살린다.
  const base = allowed || origins[0] || url.origin;
  const headers = new Headers(req.headers);
  for (const name of [...headers.keys()]) if (name.startsWith('oai-authenticated-user-') || name === 'cookie') headers.delete(name);
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await req.arrayBuffer();
  try {
    const res = await api(new Request(base + path + url.search, {method: req.method, headers, body}), env as any);
    const out = new Headers(res.headers);
    for (const [k, v] of Object.entries(cors)) out.set(k, v);
    // 작업 074: 서버 응답 보안 헤더
    if (!out.has('Cache-Control')) out.set('Cache-Control', 'no-store');
    out.set('X-Content-Type-Options', 'nosniff');
    out.set('Referrer-Policy', 'no-referrer');
    out.set('X-Frame-Options', 'DENY');
    out.set('Strict-Transport-Security', 'max-age=31536000');
    return new Response(res.body, {status: res.status, headers: out});
  } catch (error) {
    const id = reportError('entry ' + req.method + ' ' + path, error);
    return Response.json({error: `서버에서 요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요. 계속되면 오류 번호 ${id}를 알려 주세요.`, errorId: id}, {status: 500, headers: cors});
  }
});
