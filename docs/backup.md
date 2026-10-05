# DB 백업과 복구 연습 (작업 006)

## 백업
- `.github/workflows/backup.yml`이 매일 한국 시간 새벽 4시 20분에 실행된다. Actions → "DB 백업"에서 직접 실행할 수도 있다.
- public 스키마(구조+데이터)와 로그인 계정(auth 데이터)을 받아 **암호화한 파일**로 Actions 보관함에 7일간 둔다.
- 저장소가 공개라서 암호화 비밀번호가 없으면 백업하지 않는다.

### 처음 한 번: 암호화 비밀번호 등록 (대표님)
1. 긴 비밀번호를 하나 만든다(예: 비밀번호 관리자에서 32자 이상 생성). **이 비밀번호를 잃으면 백업을 열 수 없다.**
2. GitHub 저장소 → Settings → Secrets and variables → Actions → New repository secret
3. 이름 `BACKUP_PASSPHRASE`, 값에 그 비밀번호.

## 복구 연습 (분기마다 한 번)
자동: `.github/workflows/restore-drill.yml`이 1·4·7·10월 2일에 가장 최근 백업을 빈 로컬 DB에 되살리고 테이블마다 행 수가 같은지 확인한다(Actions → "백업 되살리기 연습"에서 직접 실행 가능). 결과는 실행 요약에 테이블 일치 수와 걸린 시간만 남는다(공개 저장소라 행 수는 찍지 않음).

손으로 할 때:
운영 DB에 바로 복구하지 않는다. 로컬이나 새 Supabase 프로젝트에 먼저 풀어 본다.
```
# 1) Actions → DB 백업 → 원하는 날짜 실행 → Artifacts에서 내려받아 압축 해제
sha256sum -c checksum.txt
# 2) 복호화
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass pass:'비밀번호' -in chukchuk-db-YYYY-MM-DD.tar.gz.enc | tar -xzf - -C restore/
# 3) 빈 Postgres(또는 새 Supabase 프로젝트)에 순서대로
psql "$DB_URL" -f restore/schema.sql
psql "$DB_URL" -c "set session_replication_role = replica" -f restore/data.sql   # 트리거(서류 변경 금지)를 잠시 끄고 넣기
# auth 데이터는 새 Supabase 프로젝트에 복구할 때만
psql "$DB_URL" -c "set session_replication_role = replica" -f restore/auth-data.sql
# 4) 확인: 가게 수, 계정 수, 계약서·명세서 수가 운영과 같은지
psql "$DB_URL" -c "select (select count(*) from stores) stores,(select count(*) from app_users) users,(select count(*) from contract_envelopes) contracts,(select count(*) from payslip_documents) payslips"
```
- 연습한 날짜와 결과를 아래에 적는다.

| 날짜 | 백업 날짜 | 결과 | 한 사람 |
|---|---|---|---|
