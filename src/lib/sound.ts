/** A short, soft chime at the end of a block (PIANO-V3 §5.3). Synthesised: no audio file. */
export function chime(): void {
  try {
    const ctx = new AudioContext()
    const now = ctx.currentTime
    for (const [i, freq] of [659.25, 987.77].entries()) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const start = now + i * 0.18
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.12, start + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.4)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 1.5)
    }
    setTimeout(() => void ctx.close(), 2000)
  } catch {
    // No audio on this device: the screen change is enough.
  }
}
