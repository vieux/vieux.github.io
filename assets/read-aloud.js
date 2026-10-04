(() => {
    const controls = document.querySelector('[data-read-aloud]');
    const audio = controls?.querySelector('[data-read-aloud-audio]');
    if (!audio) return;

    const speed = controls.querySelector('[data-read-aloud-speed]');
    speed.addEventListener('change', () => {
        audio.playbackRate = Number(speed.value);
    });
    controls.querySelector('[data-read-aloud-speed-control]').hidden = false;
    window.addEventListener('pagehide', () => audio.pause());
})();
