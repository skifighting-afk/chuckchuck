// 테스트용 Postgres DB. 테스트마다 새 스키마를 만들어 supabase/migrations를 적용하고 D1 모양 래퍼를 돌려준다.
// TEST_DATABASE_URL이 없으면 로컬 postgres://postgres:postgres@localhost:5432/chuck_test 를 쓴다.
import postgres from 'postgres';
import {readFileSync,readdirSync} from 'node:fs';
import {PgD1,pgTypes} from '../lib/pg-d1.ts';

const url=process.env.TEST_DATABASE_URL||'postgres://postgres:postgres@localhost:5432/chuck_test';
const dir=new URL('../supabase/migrations/',import.meta.url);
const migrations=readdirSync(dir).filter(f=>f.endsWith('.sql')).sort().map(f=>readFileSync(new URL(f,dir),'utf8'));
const open=[];

export async function testDB(){
 const schema='t_'+Math.random().toString(36).slice(2,10);
 const admin=postgres(url,{max:1,onnotice(){}});
 await admin.unsafe(`DO $$BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; END$$`);
 await admin.unsafe(`CREATE SCHEMA ${schema}`);
 await admin.end();
 const sql=postgres(url,{max:1,types:pgTypes,onnotice(){},connection:{search_path:schema}});
 for(const m of migrations)await sql.unsafe(m);
 const DB=new PgD1(sql);
 const close=async()=>{await sql.end();const a=postgres(url,{max:1,onnotice(){}});await a.unsafe(`DROP SCHEMA ${schema} CASCADE`);await a.end();};
 open.push(close);
 /** 동기 SQLite 시절 테스트 코드용: 한 줄로 질의 */
 const q=(query,...params)=>DB.prepare(query).bind(...params);
 return {DB,sql,q,close};
}

/** 열린 테스트 DB를 모두 정리한다. 각 테스트 파일 끝에서 호출. */
export async function closeAll(){while(open.length)await open.pop()();}
