import assert from 'node:assert/strict';
import {seed,duration,hours,payroll,stateSchema} from '../lib/model.ts';
const s=seed();assert.equal(stateSchema.safeParse(s).success,true);
assert.equal(duration('22:00','06:00',60),7);
assert.equal(duration('10:00','18:00',30),7.5);
s.attendance=[{id:'boundary',employeeId:'e0',start:'2026-08-31T15:30:00.000Z',end:'2026-08-31T17:30:00.000Z',breakMinutes:30,breakStart:null}];
assert.equal(hours(s.attendance[0]),1.5);assert.equal(payroll(s,'2026-09')[0].base,18000);assert.equal(payroll(s,'2026-08')[0].base,0);
s.attendance.push({...s.attendance[0],id:'open',end:null});assert.equal(payroll(s,'2026-09')[0].base,18000);
assert.equal(stateSchema.safeParse({...s,employees:[{...s.employees[0],wage:-1}]}).success,false);
console.log('PASS: overnight duration, breaks, Korean month boundaries and wage validation.');
// 전체 점검 묶음: 서버 묶음(dist/server/index.js)과 테스트용 Postgres(scripts/test-db.mjs)가 필요하다.
// 각 파일은 끝에서 자기 DB를 닫는다. 실패한 단언은 예외로 즉시 멈추고, 일부 파일은 process.exitCode로 실패를 알린다.
for(const file of ['check-team','check-admin','check-admin-overview','check-attendance-qr','check-correction-input','check-entry','check-evidence','check-final-qa','check-hq-email','check-native-auth','check-personal-access','check-qr-entry','check-saas','check-simple-join','check-simulation','check-verified-contracts','check-pay-rules','check-claims','check-withdraw','check-demo','check-error-messages','check-attendance-table','check-swaps','check-manual','check-transfer','check-rate-limit','check-push','check-ops-alert','check-cron','check-support','check-staff-docs','check-staff-asks','check-coowner','check-att-extras','check-schedule-more','check-pay-more','check-store-log','check-history','check-franchise','check-kiosk','check-open-api','check-totp','check-share','check-password','check-improve2','check-secrets','check-toss']){
 console.log('\n── '+file);
 await import('./'+file+'.mjs');
}
const {closeAll}=await import('./test-db.mjs');await closeAll();
process.exit(process.exitCode??0);
