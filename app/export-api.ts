// 작업 071: 사장님이 가게 데이터 전체를 한 파일(JSON)로 내려받는다.
// 근로기준법 제42조 보존 서류(근로계약서, 임금명세서, 출퇴근·근무 기록)를 사장님이 직접 보관할 수 있게 하는 것이 목적이다.
import {resolveStore} from './saas-api';
import {serverError} from '../lib/errors';

const json = (v: unknown, status = 200) => Response.json(v, {status, headers: {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}});
// 화면 동작용 비밀값(출퇴근 QR 토큰, 초대 링크 해시)은 내보내지 않는다.
const INTERNAL = ['_attendanceQr', '_invitations'];

export async function exportApi(request: Request, env: {DB: D1Database}) {
  const uid = request.headers.get('oai-authenticated-user-id');
  if (!uid) return json({error: '로그인해 주세요.'}, 401);
  if (request.method !== 'GET') return json({error: '이 방법으로는 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'}, 405);
  try {
    const linked = await resolveStore(env.DB, uid);
    if (linked?.access !== 'owner') return json({error: '사장님만 가게 데이터를 내려받을 수 있어요.'}, 403);
    const data = JSON.parse(linked.row.data);
    for (const k of INTERNAL) delete data[k];
    const contracts = (await env.DB.prepare('SELECT * FROM contract_envelopes WHERE owner_id=? ORDER BY created_at').bind(uid).all<any>()).results;
    const events = (await env.DB.prepare('SELECT e.envelope_id,e.version,e.status,e.recorded_at,e.record_json FROM contract_events e JOIN contract_envelopes c ON c.id=e.envelope_id WHERE c.owner_id=? ORDER BY e.id').bind(uid).all<any>()).results;
    const payslips = (await env.DB.prepare('SELECT id,employee_id,run_key,revision,document_json,created_at FROM payslip_documents WHERE owner_id=? ORDER BY created_at').bind(uid).all<any>()).results;
    const activity = (await env.DB.prepare("SELECT a.* FROM document_activity a WHERE (a.kind='payslip' AND a.document_id IN (SELECT id FROM payslip_documents WHERE owner_id=?)) OR (a.kind='contract' AND a.document_id IN (SELECT id FROM contract_envelopes WHERE owner_id=?))").bind(uid, uid).all<any>()).results;
    const evidence = (await env.DB.prepare('SELECT id,leave_id,employee_id,mime,bytes,created_at,expires_at FROM leave_evidence WHERE owner=? ORDER BY created_at').bind(uid).all<any>()).results;
    const parse = (v: any) => { try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return v; } };
    const body = {
      exportedAt: new Date().toISOString(),
      format: 'chukchuk-store-export/1',
      note: '근로계약서·임금명세서·출퇴근 기록은 근로기준법 제42조에 따라 3년간 보존해야 합니다. 이 파일을 안전한 곳에 보관하세요. 휴가 증빙 파일 본문은 들어 있지 않습니다(목록만).',
      store: data,
      contracts: contracts.map(c => ({...c, document_json: parse(c.document_json), owner_signature: parse(c.owner_signature), employee_signature: parse(c.employee_signature), events: events.filter(e => e.envelope_id === c.id).map(e => ({...e, record_json: parse(e.record_json)}))})),
      payslips: payslips.map(p => ({...p, document_json: parse(p.document_json)})),
      documentActivity: activity,
      leaveEvidence: evidence,
    };
    // 작업 056: 탈퇴 예약 전에 최근 내려받기를 확인한다.
    await env.DB.prepare('UPDATE app_users SET last_export_at=? WHERE id=?').bind(new Date().toISOString(), uid).run();
    const day = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    return new Response(JSON.stringify(body, null, 2), {headers: {'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="chukchuk-export-${day}.json"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}});
  } catch (e) {
    return serverError('export', e, '데이터를 모으지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  }
}
