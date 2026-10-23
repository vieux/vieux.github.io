# Pocket TTS in Docker

Local narration experiments using [Kyutai Pocket TTS](https://github.com/kyutai-labs/pocket-tts).
Python, CPU-only PyTorch, and Pocket TTS are installed inside the Docker image.
Models live in a Docker volume; generated audio lives in the ignored `output/` directory.
This directory is already excluded from GitHub Pages through `_config.yml`.

From the repository root, start the web interface:

```sh
docker compose -f _tools/pocket-tts/compose.yaml up -d --build
```

Open http://127.0.0.1:8765. The initial start downloads the model; later starts reuse it.
The port is bound to localhost only. This runs on CPU, including on Apple Silicon.
Pocket TTS 3.3.0 defaults to the September 2026 English model.

Generate a sample using the running server:

```sh
curl --fail-with-body http://127.0.0.1:8765/tts \
  --form-string 'text=Hello, welcome to my blog. This narration was generated locally on my Mac.' \
  --form-string 'voice_url=alba' \
  --output _tools/pocket-tts/output/sample.wav
```

Inspect startup or generation logs:

```sh
docker compose -f _tools/pocket-tts/compose.yaml logs --tail 50
```

Stop and remove the container, preserving downloaded models and audio:

```sh
docker compose -f _tools/pocket-tts/compose.yaml down
```

To also delete the model cache, use `down --volumes`. Output audio remains on disk.
The built image remains cached by Docker until removed separately.

Starting the server alone does not modify the site. The generation command below updates the selected posts.

## Generate a blog post

Requires Docker, Python 3 (standard library only), and macOS's built-in `afconvert`.
All model inference and Python ML dependencies remain inside Docker.

1. Create or edit `<slug>/index.html`, copying a current post and preserving the
   read-aloud group below the byline and the shared read-aloud CSS/JS imports.
2. Start the server with the `docker compose ... up -d --build` command above.
   Wait until `curl --fail http://127.0.0.1:8765/health` succeeds.
3. From the repository root, run:

   ```sh
   python3 _tools/pocket-tts/generate.py <slug>
   ```

   Multiple posts can be generated sequentially in one invocation:

   ```sh
   python3 _tools/pocket-tts/generate.py wake-word-echo-dot cocktailsnap-native qt2007 damn64
   ```

   The default voice is Alba. Use `--voice <name>` to choose another built-in voice.
   Progress reports completed text percentage, blocks, elapsed time, and an
   approximate remaining time; this is not a model-internal progress percentage.
4. The script extracts headings, paragraphs, list items, and code blocks from
   `<main>`, skipping figures/captions, dates, bylines, controls, hidden content,
   and `data-read-aloud-ignore`. It generates each block sequentially with a short
   pause between blocks, fixes the streaming WAV header, and encodes AAC audio.
5. Inspect the extracted text and preview the WAV in `_tools/pocket-tts/output/`.
   Listen especially to technical names, numbers, and the beginning/end. The model
   may mispronounce or omit words; successful generation alone is not a content audit.
6. Preview the post locally. The script writes `<slug>/narration.m4a` and replaces
   the control group with the recorded player and measured duration. Check desktop
   and mobile, light and dark themes, seeking/speed, and playback without JavaScript.
7. Commit the updated HTML and `narration.m4a` together. Text/WAV intermediates are
   ignored. Regenerate whenever spoken article text changes; don't manually change
   the duration label. No API key or cloud TTS subscription is needed.

The Docker image pins Pocket TTS 3.3.0 and CPU PyTorch 2.8.0. Model downloads are
cached in the named volume. The web server retains the model between requests.

## Pronunciation overrides

Edit `pronunciations.json` to change speech without changing the article. `defaults`
applies to every post; `posts.<slug>` adds or overrides replacements for one post.
For example, `S3` becomes `ess three`, while post-specific numbers and dates use
explicit spoken forms such as `25` → `twenty-five` and `October 21` →
`October twenty-first`. Numbers are deliberately scoped to the post: a year,
version number, identifier, and quantity can need different readings.

Matches are case-sensitive literal words or phrases, with longer matches first.
Substrings inside words are not replaced, and replacement text is not processed
again. Use ordinary phonetic text, not SSML. The generator saves original text in
`output/<slug>.txt` and the actual TTS input in `output/<slug>.spoken.txt` so both
can be reviewed. Preview short samples when tuning spellings, then rerun the
normal generation command to update the audio and player duration together.

Technical names may be skipped even when they are present in the extracted text.
Spell out acronyms and split compact names in the overrides (for example, `Qt`
→ `cue tee`, `C++` → `C plus plus`, and `FreeTvPlayer` → `Free tee vee Player`).
Keep version-specific overrides consistent: replacements do not cascade, so
`Qt 5` must explicitly include `cue tee` too. Expand contractions when the voice
drops their negation, such as `wasn’t` → `was not`.

For a full narration audit, compare the extracted text with the visible article,
then transcribe the generated audio locally and compare that transcript with
the spoken input. Review differences in context: transcription may normalize
`C plus plus` to `C++`, numbers to digits, and letter names to acronyms. A matching
input or a plausible total duration alone does not establish that every word
was spoken. Transcription is an additional check, not a guarantee of pronunciation.
