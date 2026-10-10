# 홈페이지 글꼴 줄이기 (fonttools 필요: pip install fonttools brotli)
#  - pretendard.woff2: Pretendard Variable(OFL) → 한글 상용 2,350자 + 영문·숫자·기호 + 페이지에 쓴 글자
#  - hand.woff2: Nanum Pen Script(OFL) → 페이지 손글씨에 쓰는 글자만(장부·메모·서명)
# 실행: python3 site/fonts/subset.py <PretendardVariable.woff2> <NanumPenScript-Regular.ttf> <미리보기 index.html>
import sys, re, html
from fontTools import subset

pretendard, pen, page = sys.argv[1:4]
text = html.unescape(re.sub(r'<[^>]+>', ' ', open(page, encoding='utf8').read()))
for f in ['site/home.ts', 'site/render.ts', 'lib/plans.ts']:
    text += open(f, encoding='utf8').read()
# KS X 1001 상용 한글 2,350자
common = ''.join(bytes([a, b]).decode('euc-kr') for a in range(0xB0, 0xC9) for b in range(0xA1, 0xFF))
ascii_ = ''.join(chr(c) for c in range(0x20, 0x7F))
extra = '·–—…✓✕⟷−×÷₩‘’“”「」→←↑↓○●'
chars = sorted(set(text + common + ascii_ + extra) - set('\n\r\t'))

def run(src, out, chars, keep_var):
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    font = subset.load_font(src, opts)
    s = subset.Subsetter(opts)
    s.populate(text=''.join(chars))
    s.subset(font)
    subset.save_font(font, out, opts)

run(pretendard, 'site/fonts/pretendard.woff2', chars, True)
raw = open(page, encoding='utf8').read()
hand_text = ''.join(html.unescape(re.sub(r'<[^>]+>', '', m)) for m in re.findall(r'class="[^"]*\bhand\b[^"]*"[^>]*>(.*?)</(?:span|b|p)>', raw, re.S))
print('hand:', ''.join(sorted(set(hand_text))))
run(pen, 'site/fonts/hand.woff2', sorted(set(hand_text + ascii_)), False)
open('site/fonts/charset.txt', 'w', encoding='utf8').write(''.join(chars))
print('ok', len(chars), 'chars')
