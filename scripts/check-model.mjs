import assert from 'node:assert/strict';
import {seed,duration,hours,payroll,stateSchema} from '../lib/model.ts';
import {api} from '../dist/server/index.js';
import {DatabaseSync} from 'node:sqlite';
const s=seed();assert.equal(stateSchema.safeParse(s).success,true);
assert.equal(duration('22:00','06:00',60),7);
assert.equal(duration('10:00','18:00',30),7.5);
s.attendance=[{id:'boundary',employeeId:'e0',start:'2026-08-31T15:30:00.000Z',end:'2026-08-31T17:30:00.000Z',breakMinutes:30,breakStart:null}];
assert.equal(hours(s.attendance[0]),1.5);assert.equal(payroll(s,'2026-09')[0].base,18000);assert.equal(payroll(s,'2026-08')[0].base,0);
s.attendance.push({...s.attendance[0],id:'open',end:null});assert.equal(payroll(s,'2026-09')[0].base,18000);
assert.equal(stateSchema.safeParse({...s,employees:[{...s.employees[0],wage:-1}]}).success,false);
console.log('PASS: overnight duration, breaks, Korean month boundaries and wage validation.');
await import('./check-team.mjs');

