// 스토어 앱(Capacitor) 안에서 돌 때만 쓰는 연결. 앱이 화면에 넣어 주는 window.Capacitor를 쓰므로 웹 묶음에 따로 넣을 것이 없다.
// 웹(브라우저)에서는 모두 아무 일도 하지 않는다.
type Cap = {isNativePlatform?: () => boolean; getPlatform?: () => string; Plugins?: Record<string, any>};
const cap = (): Cap | null => (typeof window !== 'undefined' && (window as any).Capacitor) || null;
/** 스토어 앱 안인지 */
export const isNativeApp = () => { try { return !!cap()?.isNativePlatform?.(); } catch { return false; } };
export const nativePlatform = (): 'ios' | 'android' | 'web' => { const p = cap()?.getPlatform?.(); return p === 'ios' || p === 'android' ? p : 'web'; };
const plugin = (name: string) => cap()?.Plugins?.[name] || null;

/** 앱을 켤 때 한 번: 안드로이드 뒤로 가기, 바깥 링크는 기기 브라우저로 */
export function installNativeShell() {
  if (!isNativeApp() || (window as any).__ccNative) return; (window as any).__ccNative = true;
  document.documentElement.classList.add('native-app', 'native-' + nativePlatform());
  try {
    plugin('App')?.addListener?.('backButton', ({canGoBack}: {canGoBack: boolean}) => {
      const open = document.querySelector('[role=dialog]'); if (open) { document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})); return; }
      if (canGoBack || history.length > 1) history.back(); else plugin('App')?.exitApp?.();
    });
  } catch {}
  // 다른 사이트 링크(영수증·법령 등)는 앱 안이 아니라 기기 브라우저로 연다
  addEventListener('click', e => {
    const a = (e.target as HTMLElement)?.closest?.('a[href]') as HTMLAnchorElement | null; if (!a) return;
    const u = new URL(a.href, location.href); if (u.origin === location.origin || !/^https?:$/.test(u.protocol)) return;
    e.preventDefault(); const b = plugin('Browser'); if (b?.open) void b.open({url: u.href}); else window.open(u.href, '_blank');
  }, true);
}

/** 앱 알림: 권한을 묻고 기기 토큰을 서버에 등록한다(로그인한 뒤에 부른다). 성공하면 true */
export async function registerNativePush(): Promise<boolean> {
  const P = plugin('PushNotifications'); if (!isNativeApp() || !P) return false;
  try {
    let perm = await P.checkPermissions(); if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') perm = await P.requestPermissions();
    if (perm.receive !== 'granted') return false;
    const token: string = await new Promise((ok, no) => { let done = false; P.addListener('registration', (t: {value: string}) => { if (!done) { done = true; ok(t.value); } }); P.addListener('registrationError', (err: any) => { if (!done) { done = true; no(err); } }); void P.register(); setTimeout(() => { if (!done) { done = true; no(Error('timeout')); } }, 15000); });
    // 알림을 누르면 그 화면으로
    P.addListener('pushNotificationActionPerformed', (a: any) => { const url = a?.notification?.data?.url; if (typeof url === 'string' && url.startsWith('/')) location.assign(url); });
    const r = await fetch('/api/push', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'nativeToken', token, platform: nativePlatform()})});
    return r.ok;
  } catch { return false; }
}
