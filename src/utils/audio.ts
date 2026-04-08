// Audio utilities for Google Translate TTS

export function playAudio(
  audioEl: HTMLAudioElement | null,
  text: string,
  voiceId: string,
  audioEnabled: boolean,
  forcePlay: boolean = false
): HTMLAudioElement {
  if (!audioEnabled && !forcePlay) return audioEl ?? new Audio();

  const encoded = encodeURIComponent(text);
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${voiceId}&client=gtx`;

  if (audioEl) {
    audioEl.pause();
    if (audioEl.src !== url) {
      audioEl.src = url;
      audioEl.load();
    } else {
      audioEl.currentTime = 0;
    }
    audioEl.play().catch(() => {});
  } else {
    const newAudio = new Audio(url);
    newAudio.preload = 'auto';
    newAudio.play().catch(() => {});
    return newAudio;
  }

  return audioEl;
}
