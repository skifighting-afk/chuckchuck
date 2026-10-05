# 릴스 나레이션: 무료 공개 음성 모델(MeloTTS 한국어)로 카드마다 읽어 줄 목소리를 만든다.
# 사용: python scripts/reels/tts.py 대사.json 출력폴더
#   대사.json = ["첫 카드 대사", "둘째 카드 대사", ...] → 출력폴더/voice-0.wav, voice-1.wav ...
# 실패하면 0이 아닌 값으로 끝나고, make.mjs는 목소리 없이(배경음만) 영상을 만든다.
import json, os, sys

texts = json.load(open(sys.argv[1], encoding='utf-8'))
out = sys.argv[2]
os.makedirs(out, exist_ok=True)

from melo.api import TTS  # noqa: E402  (설치가 무거워 여기서 불러온다)

speed = float(os.environ.get('REEL_TTS_SPEED', '1.15'))
model = TTS(language='KR', device='cpu')
speaker = model.hps.data.spk2id['KR']
for i, t in enumerate(texts):
    t = (t or '').strip()
    if not t:
        continue
    model.tts_to_file(t, speaker, os.path.join(out, f'voice-{i}.wav'), speed=speed, quiet=True)
    print(f'목소리 {i + 1}/{len(texts)} 만듦')
