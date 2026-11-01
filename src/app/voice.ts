/** Text to speech for ATC exercises. Most systems speak with local voices, offline. */
export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window

function voiceFor(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  const exact = voices.filter((v) => v.lang.replace('_', '-') === lang)
  const local = exact.find((v) => v.localService)
  return local ?? exact[0] ?? voices.find((v) => v.lang.startsWith(lang.slice(0, 2))) ?? null
}

export function speak(text: string, lang = 'en-GB', rate = 1): Promise<void> {
  return new Promise((resolve) => {
    if (!ttsSupported() || !text) return resolve()
    const synth = window.speechSynthesis
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    u.rate = rate
    const v = voiceFor(lang)
    if (v) u.voice = v
    // Some engines never fire `end` (no voices installed): don't wait forever.
    const timer = setTimeout(resolve, 2000 + text.length * 90)
    const done = () => {
      clearTimeout(timer)
      resolve()
    }
    u.onend = done
    u.onerror = done
    synth.speak(u)
  })
}

export const stopSpeaking = () => {
  if (ttsSupported()) window.speechSynthesis.cancel()
}
