// 네이티브 프로젝트 만들기·맞추기: `node scripts/add-native.mjs android` 또는 `ios`
// 1) 없으면 `cap add`로 만든다 2) 아이콘·스플래시 3) 권한 문구·알림·버전 4) `cap sync`
// 환경 변수: VERSION_NAME(예: 1.0.3), VERSION_CODE(정수, 빌드마다 올라감), GOOGLE_SERVICES_JSON(안드로이드 FCM 설정 JSON 내용)
import {execSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
const platform=process.argv[2];if(!['android','ios'].includes(platform))throw Error('android 또는 ios를 적어 주세요.');
const here=new URL('..',import.meta.url).pathname,run=c=>{console.log('$',c);execSync(c,{cwd:here,stdio:'inherit'})};
const VERSION_NAME=process.env.VERSION_NAME||'1.0.0',VERSION_CODE=String(Math.max(1,Number(process.env.VERSION_CODE)||1));
if(!existsSync(here+'www/index.html'))throw Error('www가 없어요. npm run www를 먼저 돌려 주세요.');
if(!existsSync(here+platform))run(`npx cap add ${platform}`);
// 아이콘·스플래시(resources/의 원본으로 모든 크기를 만든다)
run(`npx capacitor-assets generate --${platform} --iconBackgroundColor '#12634b' --iconBackgroundColorDark '#0b3d2e' --splashBackgroundColor '#12634b' --splashBackgroundColorDark '#0b3d2e'`);
const edit=(file,fn)=>{const p=here+file;const before=readFileSync(p,'utf8'),after=fn(before);if(after!==before){writeFileSync(p,after);console.log('수정:',file)}};

if(platform==='android'){
 edit('android/app/src/main/AndroidManifest.xml',s=>{
  const perms=['android.permission.CAMERA','android.permission.ACCESS_FINE_LOCATION','android.permission.ACCESS_COARSE_LOCATION','android.permission.POST_NOTIFICATIONS'];
  for(const p of perms)if(!s.includes(`"${p}"`))s=s.replace('</manifest>',`    <uses-permission android:name="${p}" />\n</manifest>`);
  if(!s.includes('android.hardware.camera'))s=s.replace('</manifest>','    <uses-feature android:name="android.hardware.camera" android:required="false" />\n</manifest>');
  return s;
 });
 edit('android/app/build.gradle',s=>s.replace(/versionCode \d+/,`versionCode ${VERSION_CODE}`).replace(/versionName "[^"]*"/,`versionName "${VERSION_NAME}"`));
 if(process.env.GOOGLE_SERVICES_JSON){writeFileSync(here+'android/app/google-services.json',process.env.GOOGLE_SERVICES_JSON);console.log('google-services.json 넣음(앱 알림)')}
 else console.log('GOOGLE_SERVICES_JSON이 없어 안드로이드 앱 알림 없이 빌드해요.');
}

if(platform==='ios'){
 const plist='ios/App/App/Info.plist';
 edit(plist,s=>{
  const add=(k,v)=>{if(!s.includes(`<key>${k}</key>`))s=s.replace(/<\/dict>\s*<\/plist>\s*$/,`\t<key>${k}</key>\n\t${v}\n</dict>\n</plist>\n`)};
  add('NSCameraUsageDescription','<string>매장 출퇴근 QR을 찍고, 체크리스트·고장 신고 사진을 올릴 때 카메라를 써요.</string>');
  add('NSLocationWhenInUseUsageDescription','<string>사장님이 출근 위치 확인을 켠 매장에서 출퇴근할 때 매장 근처인지 확인해요. 위치 좌표는 저장하지 않아요.</string>');
  add('NSPhotoLibraryUsageDescription','<string>체크리스트·공지·고장 신고에 사진을 올릴 때 사진을 골라요.</string>');
  add('ITSAppUsesNonExemptEncryption','<false/>');
  s=s.replace(/<key>CFBundleDisplayName<\/key>\s*<string>[^<]*<\/string>/,'<key>CFBundleDisplayName</key>\n\t<string>척척사장</string>');
  return s;
 });
 // 앱 알림(APNs) 권한
 writeFileSync(here+'ios/App/App/App.entitlements','<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n\t<key>aps-environment</key>\n\t<string>production</string>\n</dict>\n</plist>\n');
 // 기기 토큰을 Capacitor 알림 플러그인에 넘긴다(공식 안내의 AppDelegate 코드)
 edit('ios/App/App/AppDelegate.swift',s=>s.includes('capacitorDidRegisterForRemoteNotifications')?s:s.replace(/\n}\s*$/,`

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }
}
`));
}
run(`npx cap sync ${platform}`);
console.log(`${platform} 준비 완료 · 버전 ${VERSION_NAME} (${VERSION_CODE})`);
