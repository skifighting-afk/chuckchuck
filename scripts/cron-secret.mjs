// 가이드 57: 매일 작업(/api/cron)을 부를 때 쓰는 비밀값. 이미 있는 DB 비밀번호에서 정해진 방법으로 만든다(따로 만들 필요 없음).
// 배포 때는 서버 함수 비밀값 CRON_SECRET으로, 매일 작업에서는 요청 머리말로 같은 값을 쓴다. 로그에는 가린다.
import {createHash} from 'node:crypto';
import {appendFileSync} from 'node:fs';
const seed=process.env.CRON_SEED;if(!seed){console.log('CRON 재료 없음: 매일 작업 꺼짐');process.exit(0)}
const v=createHash('sha256').update('chukchuk-cron-v1:'+seed).digest('hex');
if(process.env.GITHUB_ENV){console.log('::add-mask::'+v);appendFileSync(process.env.GITHUB_ENV,`CRON_SECRET=${v}\n`)}
console.log('매일 작업 비밀값 준비됨');
