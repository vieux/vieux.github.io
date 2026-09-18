(() => {
    const controls = document.querySelector('[data-read-aloud]');
    const article = document.querySelector('main');

    if (!controls || !article || !('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
        return;
    }

    const synth = window.speechSynthesis;
    const toggle = controls.querySelector('[data-read-aloud-toggle]');
    const icon = controls.querySelector('[data-read-aloud-icon]');
    const label = controls.querySelector('[data-read-aloud-label]');
    const stop = controls.querySelector('[data-read-aloud-stop]');
    const status = controls.querySelector('[data-read-aloud-status]');
    const voiceSelect = controls.querySelector('[data-read-aloud-voice]');
    const preview = controls.querySelector('[data-read-aloud-preview]');
    const language = document.documentElement.lang || 'en';
    const voiceStorageKey = 'read-aloud-voice';
    let savedVoice = '';
    let voices = [];

    try {
        savedVoice = localStorage.getItem(voiceStorageKey) || '';
    } catch {
        // Reading still works when browser storage is unavailable.
    }

    function voiceKey(voice) {
        return voice.voiceURI || `${voice.name}|${voice.lang}`;
    }

    function automaticVoice() {
        // Voice names are a preference heuristic; localService is not a quality rating.
        return voices.find(voice => /natural|neural|premium|enhanced/i.test(voice.name))
            || voices.find(voice => /\b(Samantha|Alex)\b/i.test(voice.name))
            || voices.find(voice => /Google (US|UK) English/i.test(voice.name))
            || voices.find(voice => /\b(Daniel|Karen|Moira|Tessa)\b/i.test(voice.name))
            || voices.find(voice => voice.default)
            || voices[0];
    }

    function configureVoice(utterance) {
        const voice = voices.find(item => voiceKey(item) === savedVoice) || automaticVoice();
        utterance.lang = voice ? voice.lang : language;
        if (voice) {
            utterance.voice = voice;
        }
    }

    function refreshVoices() {
        const baseLanguage = language.toLowerCase().split(/[-_]/)[0];
        voices = synth.getVoices()
            .filter(voice => voice.lang.toLowerCase().split(/[-_]/)[0] === baseLanguage)
            .sort((a, b) => a.name.localeCompare(b.name) || a.lang.localeCompare(b.lang));
        const automatic = automaticVoice();
        const options = [new Option(automatic ? `Automatic — ${automatic.name}` : 'Browser default', '')];
        for (const voice of voices) {
            options.push(new Option(`${voice.name} (${voice.lang})`, voiceKey(voice)));
        }
        voiceSelect.replaceChildren(...options);
        voiceSelect.value = voices.some(voice => voiceKey(voice) === savedVoice) ? savedVoice : '';
    }
    const segmenter = typeof Intl.Segmenter === 'function'
        ? new Intl.Segmenter(language, { granularity: 'sentence' })
        : null;
    const excluded = 'figure, nav, footer, .date, .byline, [data-read-aloud], [data-read-aloud-ignore], [hidden], [aria-hidden="true"]';
    const blocks = Array.from(article.querySelectorAll('h1, h2, h3, p, li, pre'))
        .filter(node => !node.closest(excluded) && !node.parentElement.closest('p, li, pre'))
        .map(node => node.innerText.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
    const chunks = blocks.flatMap(text => {
        const sentences = segmenter
            ? Array.from(segmenter.segment(text), item => item.segment)
            : [text];

        // Short utterances avoid long-text limits in some speech engines.
        return sentences.flatMap(sentence => sentence.match(/.{1,180}(?:\s|$)|\S+/g) || [])
            .map(chunk => chunk.trim())
            .filter(Boolean);
    });

    if (!chunks.length) {
        return;
    }

    const minutes = Math.max(1, Math.ceil(blocks.join(' ').split(/\s+/).length / 160));
    const duration = `About ${minutes} min`;
    let state = 'idle';
    let chunkIndex = 0;
    let wordOffset = 0;
    let activeUtterance = null;
    let previewUtterance = null;

    function render(message) {
        const reading = state === 'reading';
        icon.textContent = reading ? 'Ⅱ' : '▶';
        label.textContent = reading ? 'Pause' : state === 'paused' ? 'Resume' : 'Listen to this post';
        toggle.setAttribute('aria-label', reading ? 'Pause reading' : state === 'paused' ? 'Resume reading' : 'Listen to this post');

        if (state === 'idle' && document.activeElement === stop) {
            toggle.focus();
        }
        stop.hidden = state === 'idle';
        preview.textContent = previewUtterance ? 'Stop preview' : 'Preview voice';
        status.textContent = message || (previewUtterance ? 'Previewing voice' : reading ? 'Reading aloud' : state === 'paused' ? 'Paused' : duration);
    }

    function cancelCurrent() {
        // Ignore delayed end/error events from a canceled utterance.
        activeUtterance = null;
        previewUtterance = null;
        synth.cancel();
    }

    function reset(message) {
        state = 'idle';
        chunkIndex = 0;
        wordOffset = 0;
        cancelCurrent();
        render(message);
    }

    function speakCurrent() {
        if (state !== 'reading') {
            return;
        }
        if (chunkIndex >= chunks.length) {
            reset('Finished');
            return;
        }

        const startOffset = wordOffset;
        const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex].slice(startOffset));
        configureVoice(utterance);

        activeUtterance = utterance;
        utterance.onboundary = event => {
            if (activeUtterance === utterance && event.charIndex < utterance.text.length) {
                wordOffset = startOffset + event.charIndex;
            }
        };
        utterance.onend = () => {
            if (activeUtterance !== utterance) {
                return;
            }
            activeUtterance = null;
            chunkIndex += 1;
            wordOffset = 0;
            speakCurrent();
        };
        utterance.onerror = event => {
            if (activeUtterance !== utterance) {
                return;
            }
            if (event.error === 'interrupted' || event.error === 'canceled') {
                state = 'paused';
                cancelCurrent();
                render('Playback interrupted. Resume to continue.');
            } else {
                reset('Audio unavailable. Try again or use another browser.');
            }
        };

        try {
            synth.speak(utterance);
        } catch {
            reset('Audio unavailable. Try again or use another browser.');
        }
    }

    toggle.addEventListener('click', () => {
        if (state === 'reading') {
            // Cancel and keep our place: native pause/resume is inconsistent on mobile.
            // Without word-boundary events, resume repeats only the current short chunk.
            state = 'paused';
            cancelCurrent();
            render();
        } else {
            cancelCurrent();
            refreshVoices();
            state = 'reading';
            render();
            speakCurrent();
        }
    });

    voiceSelect.addEventListener('change', () => {
        savedVoice = voiceSelect.value;
        try {
            localStorage.setItem(voiceStorageKey, savedVoice);
        } catch {
            // Keep the selection for this page even if it cannot be saved.
        }
        cancelCurrent();
        render();
        if (state === 'reading') {
            speakCurrent();
        }
    });

    preview.addEventListener('click', () => {
        if (previewUtterance) {
            cancelCurrent();
            render();
            return;
        }
        if (state === 'reading') {
            state = 'paused';
        }
        cancelCurrent();
        refreshVoices();

        const utterance = new SpeechSynthesisUtterance('Here is a preview of the voice that will read this post.');
        configureVoice(utterance);
        previewUtterance = utterance;
        utterance.onend = () => {
            if (previewUtterance === utterance) {
                previewUtterance = null;
                render();
            }
        };
        utterance.onerror = () => {
            if (previewUtterance === utterance) {
                previewUtterance = null;
                render('This voice is unavailable. Try another voice.');
            }
        };
        render();
        try {
            synth.speak(utterance);
        } catch {
            previewUtterance = null;
            render('This voice is unavailable. Try another voice.');
        }
    });

    controls.querySelector('details').addEventListener('toggle', event => {
        if (event.currentTarget.open) {
            refreshVoices();
        }
    });

    stop.addEventListener('click', () => reset());
    window.addEventListener('pagehide', () => {
        if (state !== 'idle' || previewUtterance) {
            reset();
        }
    });

    synth.addEventListener('voiceschanged', refreshVoices);
    refreshVoices();
    render();
    controls.hidden = false;
})();
