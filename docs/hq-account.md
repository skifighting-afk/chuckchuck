# 본사(운영자) 계정 지정 (작업 061)

본사 화면(`https://chukchukapp.kr/admin`)은 전체 가게의 집계(가게 수, 요금제, 확인할 일)를 본다.
직원 개인정보와 계약서는 보지 않는다. 본사로 인정되는 방법은 두 가지다(`app/admin-api.ts` isHQ).

| 방법 | 조건 | 지금 쓸 수 있나 |
|---|---|---|
| `HQ_NATIVE_USER_ID` | 계정 ID가 정확히 같을 때 | **예 (추천)** |
| `HQ_ADMIN_EMAIL` | 이메일이 같고, 앱에서 이메일 확인을 마쳤을 때 | 메일 발송(Resend) 연결 뒤 |

## 순서 (HQ_NATIVE_USER_ID)
1. 본사로 쓸 이메일로 `https://chukchukapp.kr`에서 사장님 가입을 한 번 한다(가게는 만들지 않아도 된다).
2. Supabase 대시보드 → Authentication → Users에서 그 이메일의 **UID**(예: `3fa9c1d2-…`)를 복사한다.
3. GitHub 저장소 → Settings → Secrets and variables → Actions → **New repository secret**
   - 이름: `HQ_NATIVE_USER_ID`
   - 값: `native:` + UID (예: `native:3fa9c1d2-77ab-4e10-9c3e-aa11bb22cc33`)
4. Actions에서 "빌드·배포"를 다시 실행(또는 아무 커밋이나 push)하면 서버 함수 비밀값에 들어간다.
5. 그 계정으로 로그인해 `/admin`이 열리는지 확인한다. 다른 사장님 계정으로는 열리지 않아야 한다.

클로드 코드에 시킬 때: "본사 계정 이메일은 ○○야. Supabase에서 UID를 찾아 GitHub 비밀값 HQ_NATIVE_USER_ID를 native:UID로 넣고 배포 후 /admin 접근을 확인해 줘."
