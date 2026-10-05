// 릴스 배경음: 저작권 걱정 없게 코드로 직접 만든 짧은 밝은 곡(남의 음원을 쓰지 않음).
// 100~108BPM, 코드 4개 반복 + 부드러운 패드 + 통통 튀는 아르페지오 + 베이스 + 작은 킥·하이햇.
// 같은 번호면 늘 같은 곡, 번호마다 조와 코드 진행이 조금씩 달라진다.
import {writeFileSync} from 'node:fs';

const SR=48000;
const midi=n=>440*Math.pow(2,(n-69)/12);
// 코드 진행(근음 기준 반음 거리, 장/단): I-V-vi-IV, vi-IV-I-V, I-vi-IV-V
const PROGS=[[[0,'M'],[7,'M'],[9,'m'],[5,'M']],[[9,'m'],[5,'M'],[0,'M'],[7,'M']],[[0,'M'],[9,'m'],[5,'M'],[7,'M']]];
const KEYS=[60,62,57,65,64]; // C D A F E

export function makeMusic(seconds,index=0,path){
 const prog=PROGS[index%PROGS.length],key=KEYS[index%KEYS.length]-12,bpm=100+(index%3)*4,beat=60/bpm,bar=beat*4;
 const n=Math.ceil(seconds*SR),L=new Float32Array(n),R=new Float32Array(n);
 let seed=1234+index*977;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647*2-1};
 const add=(t0,dur,freq,amp,shape,pan=0,attack=0.01,release=0.2)=>{
  const s0=Math.floor(t0*SR),len=Math.floor((dur+release)*SR);let ph=0;const inc=2*Math.PI*freq/SR;
  for(let i=0;i<len&&s0+i<n;i++){const t=i/SR;let env=t<attack?t/attack:t<dur?1:Math.max(0,1-(t-dur)/release);
   if(shape==='pluck')env*=Math.exp(-t*7);
   const x=shape==='tri'?(2/Math.PI)*Math.asin(Math.sin(ph)):Math.sin(ph)+(shape==='pluck'?0.3*Math.sin(2*ph):0);
   ph+=inc;const v=x*env*amp;L[s0+i]+=v*(1-pan)*0.7;R[s0+i]+=v*(1+pan)*0.7}
 };
 const bars=Math.ceil(seconds/bar)+1;
 for(let b=0;b<bars;b++){
  const [root,q]=prog[b%4],t=b*bar,third=q==='M'?4:3,base=key+root;
  // 패드: 3화음, 한 마디 길게
  for(const [iv,p] of [[0,-0.3],[third,0],[7,0.3],[12,0]])add(t,bar*0.95,midi(base+12+iv),0.045,'tri',p,0.25,0.4);
  // 베이스: 박자마다 근음
  for(let k=0;k<4;k++)add(t+k*beat,beat*0.8,midi(base-12),0.11,'sine',0,0.005,0.08);
  // 아르페지오: 8분음표, 위로 올라갔다 내려옴
  const arp=[0,third,7,12,7+12,12,7,third];
  for(let k=0;k<8;k++)add(t+k*beat/2,beat*0.4,midi(base+24+arp[k]),0.05,'pluck',k%2?0.35:-0.35,0.003,0.15);
  // 킥: 1·3박, 하이햇: 8분 뒷박
  for(const k of [0,2]){const s0=Math.floor((t+k*beat)*SR);for(let i=0;i<SR*0.18&&s0+i<n;i++){const tt=i/SR,f=110*Math.exp(-tt*18)+45;const v=Math.sin(2*Math.PI*f*tt)*Math.exp(-tt*16)*0.32;L[s0+i]+=v;R[s0+i]+=v}}
  for(let k=0;k<8;k++){if(k%2===0)continue;const s0=Math.floor((t+k*beat/2)*SR);let prev=0;for(let i=0;i<SR*0.04&&s0+i<n;i++){const w=rnd(),hp=w-prev;prev=w;const v=hp*Math.exp(-i/SR*90)*0.05;L[s0+i]+=v;R[s0+i]+=v*0.8}}
 }
 // 앞뒤 페이드, 소리 크기 맞추기
 let peak=0;for(let i=0;i<n;i++)peak=Math.max(peak,Math.abs(L[i]),Math.abs(R[i]));
 const g=0.6/Math.max(peak,1e-6),fi=SR*0.4,fo=SR*1.2;
 const buf=Buffer.alloc(44+n*4);
 buf.write('RIFF',0);buf.writeUInt32LE(36+n*4,4);buf.write('WAVE',8);buf.write('fmt ',12);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(2,22);buf.writeUInt32LE(SR,24);buf.writeUInt32LE(SR*4,28);buf.writeUInt16LE(4,32);buf.writeUInt16LE(16,34);buf.write('data',36);buf.writeUInt32LE(n*4,40);
 for(let i=0;i<n;i++){const f=Math.min(1,i/fi,(n-i)/fo);buf.writeInt16LE(Math.round(Math.max(-1,Math.min(1,L[i]*g*f))*32767),44+i*4);buf.writeInt16LE(Math.round(Math.max(-1,Math.min(1,R[i]*g*f))*32767),46+i*4)}
 writeFileSync(path,buf);
 return {bpm,key:['C','D','A','F','E'][index%5],progression:index%PROGS.length};
}
