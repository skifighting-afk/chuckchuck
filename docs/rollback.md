# 되돌리기 절차 (작업 005)

배포는 `main`에 올리면 자동으로 된다(`.github/workflows/deploy.yml`). 되돌릴 때도 `main`을 고쳐서 올리는 것이 기본이다.

## 1. 화면·서버 코드만 되돌리기 (DB 구조 변경 없음)
```
git revert <문제 커밋>        # 여러 개면 최신 것부터 차례로
git push origin main          # 자동 배포 → ci-status 브랜치의 status.json에서 test/deploy가 success인지 확인
```
- `git reset --hard` + 강제 push는 쓰지 않는다(이력이 사라진다).
- 급할 때: GitHub → Actions에서 **되돌아가고 싶은 버전의 성공한 실행**을 골라 "Re-run all jobs"를 누르면, 그 실행의 커밋으로 화면과 서버 함수가 다시 배포된다. 단, 그 사이에 적용된 DB 마이그레이션은 되돌려지지 않는다. 다음 push가 오면 다시 최신 `main`이 배포되니, 급한 불을 끈 뒤에는 위의 `git revert`로 정리한다.

## 2. DB 마이그레이션 되돌리기
Supabase 마이그레이션은 앞으로만 간다. 되돌리려면 **되돌리는 새 마이그레이션**을 만든다.
- 규칙: 마이그레이션 파일 맨 위 주석에 `-- 되돌리기:` 줄로 되돌리는 SQL을 적는다(예: `20261004010000_purge_expired.sql`).
- 순서
  1. `supabase/migrations/<새 시각>_revert_<이름>.sql`에 되돌리는 SQL을 쓴다.
  2. 로컬 테스트 DB로 확인: `npm test` (테스트는 모든 마이그레이션을 순서대로 적용한다)
  3. 커밋·푸시 → 자동 배포가 `supabase db push`로 적용
- 데이터를 지우는 되돌리기(테이블·열 삭제)는 실행 전에 백업을 받는다(작업 006).

## 3. 데이터 복구
- Supabase 무료 요금제는 자동 백업이 없다. Pro 요금제는 매일 백업(7일 보관).
- 작업 006에서 GitHub Actions로 매일 백업을 따로 받도록 할 예정이다.
- 복구는 운영 DB에 바로 하지 않고, 새 프로젝트나 로컬에 먼저 복원해 확인한 뒤 필요한 행만 옮긴다.

## 4. 옛 버전으로 완전히 돌아가기
- 2026-10-04 이전 운영본(ChatGPT Sites v23)은 `docs/handoff/`의 인계 자료와 Sites 프로젝트에 그대로 있다.
