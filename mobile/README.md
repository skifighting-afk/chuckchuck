# 척척사장 스토어 앱 (안드로이드·아이폰)

웹 화면(dist/client)을 Capacitor 8로 앱에 담는다. `android/`·`ios/` 폴더는 저장소에 두지 않고 빌드 때마다 만든다(`scripts/add-native.mjs`가 권한 문구·알림·버전을 맞춤).

- 앱 ID: `kr.chukchukapp.app` · 이름: 척척사장
- 앱 안에서는 결제·요금 화면, 카카오 로그인, 광고 측정을 숨긴다(스토어 규정). 계정 화면은 이용 상태와 회원 탈퇴만.
- 서버는 앱 화면 주소(아이폰 `capacitor://localhost`, 안드로이드 `https://localhost`)를 허용한다(`supabase/functions/api/entry.ts`).
- 앱 알림: 안드로이드 FCM, 아이폰 APNs. 기기 토큰은 `native_push_tokens` 테이블, 보내기는 `lib/native-push.ts`.

## 빌드·올리기 (GitHub Actions → '앱 빌드' → Run workflow)
- 플랫폼(both/android/ios), '스토어에 올리기' 체크, 버전(예: 1.0.0). 빌드 번호는 실행 번호로 자동.
- 체크하지 않으면 서명·업로드 없이 빌드만 하고, 안드로이드 시험용 APK(`android-test-apk`)를 Artifacts에 남긴다 → 안드로이드 휴대폰에 받아 설치해 볼 수 있다.

## 필요한 Secrets (값은 채팅에 보내지 않기)
| 이름 | 무엇 | 어디서 |
|---|---|---|
| `ANDROID_KEYSTORE_BASE64` | 업로드 키(jks)를 base64로 | `keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000` 후 `base64 -w0 upload.jks` (키 파일·비밀번호는 안전한 곳에 따로 보관) |
| `ANDROID_KEYSTORE_PASSWORD` · `ANDROID_KEY_ALIAS` · `ANDROID_KEY_PASSWORD` | 위 키의 비밀번호·별칭(upload) | 위에서 정한 값 |
| `PLAY_SERVICE_ACCOUNT_JSON` | 플레이 콘솔 API용 서비스 계정 JSON | Google Cloud → 서비스 계정 만들기 → 키(JSON) → 플레이 콘솔 '사용자 및 권한'에 초대(출시 권한) |
| `GOOGLE_SERVICES_JSON` | 안드로이드 앱 알림(FCM) 설정 파일 내용 | Firebase 콘솔 → 프로젝트 → 안드로이드 앱 추가(`kr.chukchukapp.app`) → google-services.json |
| `FCM_SERVICE_ACCOUNT` | 서버에서 FCM 보내기용 서비스 계정 JSON | Firebase → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 |
| `APPSTORE_KEY_ID` · `APPSTORE_ISSUER_ID` · `APPSTORE_KEY_P8` | App Store Connect API 키(앱 관리자 권한) | App Store Connect → 사용자 및 액세스 → 통합 → App Store Connect API |
| `APPLE_TEAM_ID` | 애플 개발자 팀 ID(10자) | developer.apple.com → Membership |
| `APNS_KEY` · `APNS_KEY_ID` · `APNS_TEAM_ID` | 아이폰 앱 알림 키(.p8 내용)·키 ID·팀 ID | developer.apple.com → Keys → Apple Push Notifications service |

## 처음 한 번만
1. 구글: 플레이 콘솔에서 앱 만들기(패키지 `kr.chukchukapp.app`) → 첫 AAB는 콘솔에 직접 올리기(Artifacts의 `android-aab`) → 이후는 자동 업로드. 개인 계정은 비공개 테스트(테스터 12명·14일)를 거쳐야 프로덕션 신청 가능.
2. 애플: developer.apple.com에서 App ID `kr.chukchukapp.app`(Push Notifications 켜기) → App Store Connect에서 앱 만들기 → 워크플로로 TestFlight 업로드.
3. 스토어 글·개인정보 답변·스크린샷: `store/등록자료.md`, `store/screenshots/`.

## 다시 만들기
- 아이콘·스플래시 원본: `node mobile/scripts/render-icons.mjs` (playwright)
- 스크린샷: `E2E_WWW=<빌드 폴더> node scripts/store-screenshots.mjs`
