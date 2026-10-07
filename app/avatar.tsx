'use client';
// 지시서 159: 직원 사진(없으면 이름 두 글자). 사진은 160px로 줄여 가게 데이터에 둔다.
export function Avatar({e,i=0}:{e:{name:string,photo?:string},i?:number}){
 return (e as any).photo?<img className="avatar avatar-photo" src={(e as any).photo} alt="" width={40} height={40}/>:<span className={'avatar color-'+i%4}>{e.name.slice(-2)}</span>;
}
export async function avatarFrom(file:File){
 const bmp=await createImageBitmap(file),side=160,k=side/Math.min(bmp.width,bmp.height),c=document.createElement('canvas');c.width=side;c.height=side;
 const ctx=c.getContext('2d')!;ctx.drawImage(bmp,(side-bmp.width*k)/2,(side-bmp.height*k)/2,bmp.width*k,bmp.height*k);
 return c.toDataURL('image/jpeg',0.8);
}
