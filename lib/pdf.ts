// 작업 039(PDF): 페이지 이미지(JPEG)를 A4 PDF 한 파일로. 글꼴을 넣지 않아 한글이 깨지지 않고 휴대폰에서 바로 저장된다.
export type PdfPage = {jpeg: Uint8Array; width: number; height: number};
const A4 = [595.28, 841.89];
export function imagesToPdf(pages: PdfPage[], title = '척척사장 문서'): Uint8Array<ArrayBuffer> {
  if (!pages.length) throw Error('PDF로 만들 페이지가 없어요.');
  const enc = new TextEncoder(), parts: Uint8Array[] = [], offsets: number[] = [];
  let size = 0;
  const push = (v: string | Uint8Array) => { const b = typeof v === 'string' ? enc.encode(v) : v; parts.push(b); size += b.length; };
  const obj = (n: number, body: (string | Uint8Array)[]) => { offsets[n] = size; push(`${n} 0 obj\n`); body.forEach(push); push('\nendobj\n'); };
  // 제목은 UTF-16BE 16진 문자열로(한글 안전)
  const hex = (s: string) => '<FEFF' + Array.from(s).map(c => { const u = c.codePointAt(0)!; if (u > 0xffff) { const v = u - 0x10000; return ((0xd800 + (v >> 10)).toString(16) + (0xdc00 + (v & 0x3ff)).toString(16)).toUpperCase().padStart(8, '0'); } return u.toString(16).toUpperCase().padStart(4, '0'); }).join('') + '>';
  push('%PDF-1.4\n'); push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  const n = pages.length, kids = pages.map((_, i) => `${4 + i * 3} 0 R`).join(' ');
  obj(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
  obj(2, [`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`]);
  obj(3, [`<< /Title ${hex(title)} /Producer (chukchukapp) >>`]);
  pages.forEach((p, i) => {
    const page = 4 + i * 3, content = page + 1, image = page + 2;
    // 비율을 지키며 A4 안에 맞춘다
    const scale = Math.min(A4[0] / p.width, A4[1] / p.height), w = +(p.width * scale).toFixed(2), h = +(p.height * scale).toFixed(2), x = +((A4[0] - w) / 2).toFixed(2), y = +((A4[1] - h) / 2).toFixed(2);
    const draw = `q ${w} 0 0 ${h} ${x} ${y} cm /Im0 Do Q`;
    obj(page, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4[0]} ${A4[1]}] /Resources << /XObject << /Im0 ${image} 0 R >> >> /Contents ${content} 0 R >>`]);
    obj(content, [`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`]);
    obj(image, [`<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`, p.jpeg, '\nendstream']);
  });
  const count = 4 + n * 3, xref = size;
  push(`xref\n0 ${count}\n0000000000 65535 f \n` + offsets.slice(1, count).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join(''));
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(size); let at = 0; for (const b of parts) { out.set(b, at); at += b.length; } return out;
}
