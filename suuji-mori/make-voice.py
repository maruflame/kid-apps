#!/usr/bin/env python3
"""すうじのもり の読み上げ音声を VOICEVOX で作る（macOS 用）。

つかいかた:
  1. VOICEVOX（https://voicevox.hiroshiba.jp/）を起動しておく
  2. python3 suuji-mori/make-voice.py        … 足りない音声だけ作る
     python3 suuji-mori/make-voice.py --all  … ぜんぶ作りなおす

index.html の「// @lines-begin 〜 // @lines-end」を macOS の JavaScriptCore で動かして
allLines()（読み上げる日本語の1文 ぜんぶ）を取り出し、1文ずつ voice/<id>.m4a にする。
最後に voice/clips.js（アプリが読む 音声の一覧とクレジット）を書く。
声や話し方を変えたら 下の設定を書きかえて もう一度動かす（設定が変わると ぜんぶ作りなおす）。
"""
import json
import os
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request

SPEAKER = 'ずんだもん'
STYLE = 'ノーマル'
SETTINGS = {
    'speedScale': 1.0,        # はやさ
    'pitchScale': 0.0,        # 高さ
    'intonationScale': 1.0,   # 抑揚
    'prePhonemeLength': 0.05, # 前後の無音（つなぎめの間を短くする）
    'postPhonemeLength': 0.05,
}
ENGINE = 'http://127.0.0.1:50021'
BITRATE = 40000  # AAC のビットレート

HERE = os.path.dirname(os.path.abspath(__file__))
HTML = os.path.join(HERE, 'index.html')
OUT = os.path.join(HERE, 'voice')
CLIPS_JS = os.path.join(OUT, 'clips.js')
JSC = '/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc'
PREFIX = 'window.VOICE = '


def all_lines():
    html = open(HTML, encoding='utf-8').read()
    try:
        region = html.split('// @lines-begin', 1)[1].split('// @lines-end', 1)[0].split('\n', 1)[1]
    except IndexError:
        sys.exit('index.html に // @lines-begin 〜 // @lines-end が見つかりません')
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
        f.write(region + '\nprint(JSON.stringify(allLines()));\n')
    try:
        out = subprocess.run([JSC, f.name], capture_output=True, text=True, check=True).stdout
    finally:
        os.unlink(f.name)
    lines = json.loads(out)
    if len({l['id'] for l in lines}) != len(lines):
        sys.exit('ファイル名（ハッシュ）が重なりました。clipId を見なおしてください')
    return lines


def api(path, params=None, body=None, method='POST'):
    url = f'{ENGINE}{path}?{urllib.parse.urlencode(params or {})}'
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def speaker_id():
    try:
        speakers = json.loads(api('/speakers', method='GET'))
    except urllib.error.URLError:
        sys.exit(f'VOICEVOX につながりません（{ENGINE}）。VOICEVOX を起動してから もう一度動かしてください')
    for sp in speakers:
        if sp['name'] == SPEAKER:
            for st in sp['styles']:
                if st['name'] == STYLE:
                    return st['id']
    sys.exit(f'VOICEVOX に「{SPEAKER}（{STYLE}）」がありません')


def load_prev():
    try:
        s = open(CLIPS_JS, encoding='utf-8').read()
        return json.loads(s[s.index(PREFIX) + len(PREFIX):].strip().rstrip(';'))
    except (OSError, ValueError):
        return {}


def main():
    lines = all_lines()
    sid = speaker_id()
    os.makedirs(OUT, exist_ok=True)
    conf = {'speaker': SPEAKER, 'style': STYLE, **SETTINGS}
    redo = '--all' in sys.argv or load_prev().get('conf') != conf

    todo = [l for l in lines if redo or not os.path.exists(os.path.join(OUT, l['id'] + '.m4a'))]
    print(f'{len(lines)} 文のうち {len(todo)} 文を作ります（{SPEAKER}・{STYLE}）')
    for i, l in enumerate(todo, 1):
        q = json.loads(api('/audio_query', {'text': l['text'], 'speaker': sid}))
        q.update(SETTINGS)
        wav = api('/synthesis', {'speaker': sid}, q)
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
            f.write(wav)
        try:
            subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', str(BITRATE), f.name,
                            os.path.join(OUT, l['id'] + '.m4a')], check=True)
        finally:
            os.unlink(f.name)
        print(f'  [{i}/{len(todo)}] {l["text"]}')

    # もう使わない音声を消す
    keep = {l['id'] + '.m4a' for l in lines}
    stale = [n for n in os.listdir(OUT) if n.endswith('.m4a') and n not in keep]
    for n in stale:
        os.remove(os.path.join(OUT, n))

    data = {'credit': f'VOICEVOX:{SPEAKER}', 'conf': conf, 'ids': sorted(l['id'] for l in lines)}
    with open(CLIPS_JS, 'w', encoding='utf-8') as f:
        f.write('// make-voice.py が作るファイル（手で書きかえない）\n')
        f.write(PREFIX + json.dumps(data, ensure_ascii=False) + ';\n')
    print(f'できました：{len(lines)} 文（消した古い音声 {len(stale)} 個）→ {os.path.relpath(OUT)}')


if __name__ == '__main__':
    main()
