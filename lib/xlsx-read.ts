// 엑셀(.xlsx)·CSV 파일을 표(문자열 2차원 배열)로 읽는다. 외부 라이브러리 없이 브라우저 내장 압축 해제만 쓴다.
// .xlsx는 zip 안에 xl/sharedStrings.xml(글자)과 xl/worksheets/sheet1.xml(첫 시트)이 있다.
// 날짜 칸은 엑셀 일련번호로 저장되므로 header가 날짜 열이면 YYYY-MM-DD로 바꾸는 일은 호출하는 쪽(toBulkText)이 한다.

async function inflate(data:Uint8Array):Promise<Uint8Array>{
 const ds=new DecompressionStream('deflate-raw');
 const out=new Response(new Blob([data as BlobPart]).stream().pipeThrough(ds));
 return new Uint8Array(await out.arrayBuffer());
}
/** zip 중앙 디렉터리를 읽어 이름 → 내용 */
export async function unzip(buf:ArrayBuffer,want:(name:string)=>boolean):Promise<Record<string,string>>{
 const b=new Uint8Array(buf),v=new DataView(buf),files:Record<string,string>={};
 let eocd=-1;for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(v.getUint32(i,true)===0x06054b50){eocd=i;break}
 if(eocd<0)throw Error('엑셀 파일을 읽지 못했어요. .xlsx로 저장한 파일인지 확인해 주세요.');
 const count=v.getUint16(eocd+10,true);let p=v.getUint32(eocd+16,true);
 const dec=new TextDecoder();
 for(let n=0;n<count;n++){
  if(v.getUint32(p,true)!==0x02014b50)break;
  const method=v.getUint16(p+10,true),size=v.getUint32(p+20,true),nameLen=v.getUint16(p+28,true),extra=v.getUint16(p+30,true),comment=v.getUint16(p+32,true),local=v.getUint32(p+42,true);
  const name=dec.decode(b.subarray(p+46,p+46+nameLen));p+=46+nameLen+extra+comment;
  if(!want(name))continue;
  const start=local+30+v.getUint16(local+26,true)+v.getUint16(local+28,true),raw=b.subarray(start,start+size);
  files[name]=dec.decode(method===0?raw:await inflate(raw));
 }
 return files;
}
const unxml=(s:string)=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,d)=>String.fromCharCode(Number(d))).replace(/&amp;/g,'&');
const colIndex=(ref:string)=>{let n=0;for(const c of ref.replace(/\d+$/,''))n=n*26+(c.charCodeAt(0)-64);return n-1};
/** 시트 XML + 공유 문자열 → 표 */
export function sheetRows(sheetXml:string,sharedXml=''):string[][]{
 const shared=[...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m=>[...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t=>unxml(t[1])).join(''));
 const rows:string[][]=[];
 for(const r of sheetXml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)){
  const row:string[]=[];
  for(const c of r[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
   const attrs=c[1],body=c[2]||'',ref=/r="([A-Z]+\d+)"/.exec(attrs)?.[1],type=/t="(\w+)"/.exec(attrs)?.[1];
   const val=/<v>([\s\S]*?)<\/v>/.exec(body)?.[1];let text='';
   if(type==='s'&&val!==undefined)text=shared[Number(val)]??'';
   else if(type==='inlineStr')text=[...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t=>unxml(t[1])).join('');
   else if(val!==undefined)text=unxml(val);
   const i=ref?colIndex(ref):row.length;while(row.length<i)row.push('');row[i]=text.trim();
  }
  if(row.some(x=>x))rows.push(row);
 }
 return rows;
}
export async function readXlsx(buf:ArrayBuffer):Promise<string[][]>{
 const f=await unzip(buf,n=>n==='xl/sharedStrings.xml'||/^xl\/worksheets\/sheet\d+\.xml$/.test(n)||n==='xl/workbook.xml');
 const sheet=Object.keys(f).filter(n=>n.startsWith('xl/worksheets/')).sort()[0];
 if(!sheet)throw Error('엑셀 파일에서 시트를 찾지 못했어요.');
 return sheetRows(f[sheet],f['xl/sharedStrings.xml']||'');
}
/** 따옴표를 지키는 CSV 읽기(쉼표·탭 모두) */
export function readCsv(text:string):string[][]{
 text=text.replace(/^﻿/,'');const sep=(text.split('\n')[0].match(/\t/g)||[]).length>(text.split('\n')[0].match(/,/g)||[]).length?'\t':',';
 const rows:string[][]=[];let row:string[]=[],cell='',q=false;
 for(let i=0;i<text.length;i++){const c=text[i];
  if(q){if(c==='"'&&text[i+1]==='"'){cell+='"';i++}else if(c==='"')q=false;else cell+=c;continue}
  if(c==='"')q=true;else if(c===sep){row.push(cell.trim());cell=''}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(x=>x))rows.push(row);row=[];cell=''}else cell+=c;
 }
 row.push(cell.trim());if(row.some(x=>x))rows.push(row);
 return rows;
}
/** 엑셀 일련번호(1900 날짜 체계) → YYYY-MM-DD */
export const serialDate=(n:number)=>new Date(Date.UTC(1899,11,30)+Math.round(n)*86400000).toISOString().slice(0,10);
/** 직원 일괄 등록 열(이름·연락처·이메일·입사일·…)에 맞게 다듬어 탭 글로 바꾼다. 앞 0이 빠진 휴대폰 번호와 날짜 숫자를 고친다. */
export function toBulkText(rows:string[][]):string{
 return rows.map(r=>{const x=[...r];
  if(/^1\d{8,9}$/.test(x[1]||''))x[1]='0'+x[1];
  if(/^\d{5}(\.\d+)?$/.test(x[3]||''))x[3]=serialDate(Number(x[3]));
  return x.map(v=>(v||'').replace(/[\t\n]/g,' ')).join('\t')}).join('\n');
}
