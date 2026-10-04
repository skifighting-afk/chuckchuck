// Keep only the store QR context through sign-in. Never accept an arbitrary return URL.
export function attendanceQrEntry(path:string,search:string):string|null {
 if(path!=='/app'&&path!=='/login')return null;
 const q=new URLSearchParams(search),branch=q.get('branch'),token=q.get('attendanceQr');
 if(!branch||branch.length>100||/[\u0000-\u001f]/.test(branch)||!token||!/^[-a-f0-9]{72}$/.test(token))return null;
 const next=new URLSearchParams({branch,attendanceQr:token});
 return '/app?'+next.toString()+'#attendance';
}

export function cameraErrorMessage(error:unknown):string {
 const name=error instanceof Error?error.name:'';
 if(name==='NotAllowedError'||name==='SecurityError')return '카메라 권한이 꺼져 있어요. 브라우저 설정에서 허용하거나 아래 QR 사진 읽기를 이용해 주세요.';
 if(name==='NotFoundError'||name==='OverconstrainedError')return '사용할 수 있는 카메라를 찾지 못했어요. 휴대폰에서 열거나 아래 QR 사진 읽기를 이용해 주세요.';
 if(name==='NotReadableError'||name==='AbortError')return '카메라를 다른 앱에서 사용 중이거나 잠시 열 수 없어요. 다른 앱을 닫고 다시 시도하거나 QR 사진을 골라 주세요.';
 return '카메라를 열지 못했어요. 아래 QR 사진 읽기를 이용하거나 휴대폰 기본 카메라로 매장 QR을 열어 주세요.';
}
