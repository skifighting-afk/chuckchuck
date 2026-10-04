import {useEffect,useRef,useState} from 'react';
import jsQR from '../lib/vendor/jsQR.cjs';
import {cameraErrorMessage} from '../lib/qr-entry';
export function AttendanceScan({branchId,kind,demo,busy,onConfirm,onClose}:{branchId:string,kind:string,demo:boolean,busy:boolean,onConfirm:(token:string)=>Promise<boolean>,onClose:()=>void}){
 const [error,setError]=useState(''),[token,setToken]=useState(''),[running,setRunning]=useState(false),[opening,setOpening]=useState(false);
 const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),timer=useRef<ReturnType<typeof setInterval>|null>(null),closed=useRef(false),openingRef=useRef(false),generation=useRef(0);
 const stop=()=>{generation.current++;openingRef.current=false;setOpening(false);if(timer.current)clearInterval(timer.current);timer.current=null;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(video.current)video.current.srcObject=null;setRunning(false)};
 useEffect(()=>{closed.current=false;return()=>{closed.current=true;generation.current++;if(timer.current)clearInterval(timer.current);stream.current?.getTracks().forEach(t=>t.stop())}},[]);
 const accept=(value:string)=>{setToken('');try{const u=new URL(value);if(u.origin!==location.origin||u.pathname!=='/app')throw Error('척척사장봇 매장 QR을 찍어 주세요.');if(u.searchParams.get('branch')!==branchId)throw Error('다른 매장의 QR이에요. 우리 매장 QR을 확인해 주세요.');const t=u.searchParams.get('attendanceQr');if(!t||!/^[-a-f0-9]{72}$/.test(t))throw Error('이전 QR이거나 올바르지 않은 QR이에요. 사장님께 새 출퇴근 QR을 요청해 주세요.');stop();setToken(t);setError('')}catch(e){setError(e instanceof Error?e.message:'QR을 읽지 못했어요.')}};
 const decode=(source:CanvasImageSource,w:number,h:number)=>{const scale=Math.min(1,900/Math.max(w,h)),c=document.createElement('canvas');c.width=Math.round(w*scale);c.height=Math.round(h*scale);const ctx=c.getContext('2d',{willReadFrequently:true});if(!ctx)return false;ctx.drawImage(source,0,0,c.width,c.height);const d=ctx.getImageData(0,0,c.width,c.height),r=jsQR(d.data,c.width,c.height);if(!r)return false;accept(r.data);return true};
 const start=async()=>{
  if(openingRef.current)return;
  stop();const attempt=generation.current;openingRef.current=true;setOpening(true);setError('');setToken('');
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('camera unavailable');
   const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
   if(closed.current||attempt!==generation.current){s.getTracks().forEach(t=>t.stop());return}
   stream.current=s;const element=video.current;if(!element){s.getTracks().forEach(t=>t.stop());return}
   element.srcObject=s;await element.play();
   if(closed.current||attempt!==generation.current){s.getTracks().forEach(t=>t.stop());return}
   setRunning(true);timer.current=setInterval(()=>{const v=video.current;if(v&&v.readyState>=2)decode(v,v.videoWidth,v.videoHeight)},300);
  }catch(e){if(!closed.current&&attempt===generation.current){stop();setError(cameraErrorMessage(e))}}
  finally{if(!closed.current&&attempt===generation.current){openingRef.current=false;setOpening(false)}}
 };
 const file=async(f?:File)=>{
  if(!f)return;stop();const attempt=generation.current;setError('');setToken('');
  if(!f.type.startsWith('image/')||f.size>10*1024*1024){setError('10MB 이하의 QR 사진을 골라 주세요.');return}
  const url=URL.createObjectURL(f);
  try{const img=new Image();img.src=url;await img.decode();if(closed.current||attempt!==generation.current)return;if(!decode(img,img.width,img.height))setError('사진에서 QR을 찾지 못했어요. QR 전체가 선명하게 보이도록 다시 찍어 주세요.')}
  catch{if(!closed.current&&attempt===generation.current)setError('사진을 읽지 못했어요. JPG 또는 PNG 사진을 이용해 주세요.')}
  finally{URL.revokeObjectURL(url)}
 };
 const label=kind==='out'?'퇴근':'출근';
 return <section className="t-gap" style={{borderTop:"1px solid #d7e4dc",paddingTop:20}} aria-label="매장 QR 확인"><h2>{label} 전에 매장 QR을 찍어 주세요</h2><p>매장에 붙어 있는 QR을 확인한 뒤 {label} 시간을 기록해요.</p>{demo?<><p className="notice">체험 화면이에요. 아래 버튼으로 QR 확인 과정을 체험할 수 있어요. 실제 기록은 저장하지 않아요.</p><button className="primary" onClick={()=>setToken('demo')}>체험용 QR 확인하기</button></>:<><video ref={video} muted playsInline style={{width:'100%',maxHeight:280,background:'#123e32',borderRadius:12,display:running?'block':'none'}}/><div className="t-wrapactions"><button className="primary" disabled={busy||opening} onClick={start}>{opening?'카메라 여는 중…':running?'카메라 다시 열기':'카메라로 QR 찍기'}</button><label className="secondary" style={{display:"flex",flexDirection:"column",gap:8,maxWidth:"100%"}}>QR 사진 읽기<input style={{maxWidth:"100%",minWidth:0}} aria-label="QR 사진 선택" type="file" accept="image/*" capture="environment" onChange={e=>{void file(e.target.files?.[0]);e.target.value=''}}/></label></div>{new URLSearchParams(location.search).has('attendanceQr')&&<button className="secondary t-gap" onClick={()=>accept(location.href)}>휴대폰 카메라로 연 QR 확인하기</button>}<small style={{display:"block",lineHeight:1.6,marginTop:12}}>사진과 카메라 영상은 기기 안에서 읽으며 서버로 전송하지 않아요.</small></>}{error&&<p className="saas-error" role="alert">{error}</p>}{token&&<div className="notice t-gap"><b>QR을 읽었어요.</b><p>아래 버튼을 누르면 서버에서 우리 매장 QR인지 확인하고 {label} 시간을 기록해요.</p><button className="primary" disabled={busy} onClick={async()=>{if(await onConfirm(token)){stop();onClose()}else{setToken('');setError('기록하지 못했어요. 화면의 오류 안내를 확인하고 다시 QR을 찍어 주세요.')}}}>{busy?'기록 중…':label+' 기록하기'}</button></div>}<button className="secondary t-gap" disabled={busy} onClick={()=>{stop();onClose()}}>취소 · 기록하지 않기</button><p className="footnote">QR 확인은 위치 인증이 아닙니다. 촬영·공유된 QR로도 읽을 수 있어요. 카메라를 사용할 수 없다면 사장님께 수동 기록을 요청하세요.</p></section>
}
