// 문서 본문을 A4 비율(1240×1754) 페이지 이미지로 그린다. 이미지 저장·PDF 저장이 같은 그림을 쓴다.
import {imagesToPdf,type PdfPage} from '../lib/pdf';
export const PAGE_W=1240,PAGE_H=1754,LINES=34;
export async function renderPages(title:string,text:string,footer:string,type:'image/png'|'image/jpeg'='image/png'):Promise<Blob[]>{
 await document.fonts.ready;const canvas=document.createElement('canvas');canvas.width=PAGE_W;canvas.height=PAGE_H;const ctx=canvas.getContext('2d')!;ctx.font='26px sans-serif';
 const lines:string[]=[];for(const paragraph of text.split('\n')){let line='';for(const ch of paragraph){if(ctx.measureText(line+ch).width>1080){lines.push(line);line=''}line+=ch;}lines.push(line)}
 const blobs:Blob[]=[],count=Math.max(1,Math.ceil(lines.length/LINES));
 for(let p=0;p<count;p++){ctx.fillStyle='white';ctx.fillRect(0,0,PAGE_W,PAGE_H);ctx.fillStyle='#155b45';ctx.font='bold 32px sans-serif';ctx.fillText('척척사장봇 · '+title,80,90);ctx.fillStyle='#172e27';ctx.font='26px sans-serif';lines.slice(p*LINES,(p+1)*LINES).forEach((line,i)=>ctx.fillText(line,80,165+i*43));ctx.font='20px sans-serif';ctx.fillText(footer+' · '+(p+1)+' / '+count,80,1685);blobs.push(await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('이미지를 만들지 못했어요.')),type,0.9)))}
 return blobs;
}
/** 여러 문서를 한 PDF로(합본). docs: [{title,text,footer}] */
export async function documentsPdf(docs:{title:string,text:string,footer:string}[],pdfTitle:string):Promise<Blob>{
 const pages:PdfPage[]=[];for(const d of docs)for(const b of await renderPages(d.title,d.text,d.footer,'image/jpeg'))pages.push({jpeg:new Uint8Array(await b.arrayBuffer()),width:PAGE_W,height:PAGE_H});
 return new Blob([imagesToPdf(pages,pdfTitle)],{type:'application/pdf'});
}
export function saveBlob(name:string,blob:Blob){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name.replace(/[\\/:*?"<>|]+/g,"-");a.rel="noopener";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
