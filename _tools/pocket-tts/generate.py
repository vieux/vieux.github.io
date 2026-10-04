#!/usr/bin/env python3
"""Generate article narration using the local Docker server; Python stdlib only."""
import argparse
import io
import re
import subprocess
import time
import urllib.parse
import urllib.request
import wave
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = Path(__file__).resolve().parent / 'output'
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}


class Article(HTMLParser):
    """Mirror the site's read-aloud exclusions without third-party dependencies."""
    def __init__(self):
        super().__init__()
        self.stack = []
        self.blocks = []
        self.current = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if self.current and tag in {'p', 'li', 'pre', 'ul', 'ol'}:
            self.current[2].append(' ')
        ignored = ((self.stack and self.stack[-1][1])
                   or tag in {'figure', 'nav', 'footer', 'script', 'style'}
                   or bool(set(attrs.get('class', '').split()) & {'date', 'byline'})
                   or any(k in attrs for k in ('hidden', 'data-read-aloud', 'data-read-aloud-ignore'))
                   or attrs.get('aria-hidden') == 'true')
        if tag not in VOID:
            self.stack.append((tag, ignored))
        if (tag in {'h1', 'h2', 'h3', 'p', 'li', 'pre'} and not ignored
                and any(t == 'main' for t, _ in self.stack) and self.current is None):
            self.current = (tag, len(self.stack), [])
        if tag == 'br' and self.current:
            self.current[2].append(' ')

    def handle_data(self, data):
        if self.current and not self.stack[-1][1]:
            self.current[2].append(data)

    def handle_endtag(self, tag):
        if self.current and tag in {'p', 'li', 'pre', 'ul', 'ol'}:
            self.current[2].append(' ')
        if self.current and tag == self.current[0] and len(self.stack) == self.current[1]:
            text = ' '.join(''.join(self.current[2]).split())
            if text:
                self.blocks.append(text)
            self.current = None
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                self.stack = self.stack[:i]
                break


def player(seconds):
    duration = f'{round(seconds) // 60}:{round(seconds) % 60:02d}'
    return f'''        <div class="read-aloud read-aloud-recorded" data-read-aloud role="group" aria-label="Listen to this post">
            <span id="narration-label">Listen to this post <span class="read-aloud-status">— {duration} · AI narration</span></span>
            <audio controls preload="none" data-read-aloud-audio aria-labelledby="narration-label">
                <source src="narration.m4a" type="audio/mp4">
                <a href="narration.m4a">Download the audio</a>
            </audio>
            <label data-read-aloud-speed-control hidden>Speed
                <select data-read-aloud-speed aria-label="Narration playback speed">
                    <option value="0.75">0.75×</option>
                    <option value="1" selected>1×</option>
                    <option value="1.25">1.25×</option>
                    <option value="1.5">1.5×</option>
                    <option value="2">2×</option>
                </select>
            </label>
        </div>'''


def generate(slug, voice, server):
    if not re.fullmatch(r'[a-z0-9-]+', slug):
        raise ValueError(f'Invalid post slug: {slug}')
    page = ROOT / slug / 'index.html'
    source = page.read_text()
    parser = Article()
    parser.feed(source)
    if not parser.blocks:
        raise ValueError(f'No article text in {page}')
    # Existing posts and new posts copied from them have controls below the byline.
    pattern = r'        <div class="read-aloud\b.*?(?=\n\n        <)'
    if len(re.findall(pattern, source, re.S)) != 1:
        raise ValueError('Expected one read-aloud control group; copy a current post first.')
    OUTPUT.mkdir(exist_ok=True)
    (OUTPUT / f'{slug}.txt').write_text('\n\n'.join(parser.blocks) + '\n')
    wav_path = OUTPUT / f'{slug}.wav'
    started = time.monotonic()
    total = sum(len(block.split()) for block in parser.blocks)
    completed = 0
    params = None
    with wave.open(str(wav_path), 'wb') as destination:
        for i, block in enumerate(parser.blocks, 1):
            request = urllib.request.Request(server + '/tts', data=urllib.parse.urlencode(
                {'text': block, 'voice_url': voice}).encode())
            with urllib.request.urlopen(request, timeout=600) as response:
                data = response.read()
            # The streaming response has a placeholder length. wave reads to EOF;
            # writing it again produces a WAV with the correct length.
            with wave.open(io.BytesIO(data)) as audio:
                current = (audio.getnchannels(), audio.getsampwidth(), audio.getframerate())
                if params is None:
                    params = current
                    destination.setnchannels(params[0])
                    destination.setsampwidth(params[1])
                    destination.setframerate(params[2])
                if current != params:
                    raise ValueError('Inconsistent audio format')
                frames = audio.readframes(audio.getnframes())
                if not frames:
                    raise ValueError('Empty audio response')
                destination.writeframes(frames)
                if i < len(parser.blocks):
                    destination.writeframes(b'\0' * int(params[2] * 0.25) * params[0] * params[1])
            completed += len(block.split())
            elapsed = time.monotonic() - started
            remaining = elapsed * (total - completed) / completed
            print(f'{slug}: {completed / total:.0%}, block {i}/{len(parser.blocks)}, '
                  f'{elapsed:.0f}s elapsed, ~{remaining:.0f}s remaining', flush=True)
    with wave.open(str(wav_path)) as audio:
        seconds = audio.getnframes() / audio.getframerate()
    # macOS built-in encoder: no host packages to install. Publish only on success.
    encoded = OUTPUT / f'{slug}.m4a'
    if encoded.exists():
        encoded.unlink()
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', str(wav_path), str(encoded)], check=True)
    (ROOT / slug / 'narration.m4a').write_bytes(encoded.read_bytes())
    page.write_text(re.sub(pattern, lambda _: player(seconds), source, flags=re.S))
    print(f'{slug}: saved {seconds:.1f}s narration ({encoded.stat().st_size // 1024} KiB)', flush=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('slugs', nargs='+', help='Post directory names')
    ap.add_argument('--voice', default='alba')
    ap.add_argument('--server', default='http://127.0.0.1:8765')
    args = ap.parse_args()
    for slug in args.slugs:
        generate(slug, args.voice, args.server.rstrip('/'))


if __name__ == '__main__':
    main()
