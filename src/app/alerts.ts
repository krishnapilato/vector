/**
 * End-of-phase signal: a short, soft tone and, if allowed, a system notification.
 * No sound effects anywhere else in the app.
 */
export function beep(): void {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 660
    gain.gain.value = 0.08
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.25)
    osc.onended = () => void ctx.close()
  } catch {
    // Audio unavailable: the visual change is enough.
  }
}

export function notify(title: string, body: string): void {
  beep()
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: `${import.meta.env.BASE_URL}icon-192.png`, silent: true })
  }
}

/** Asked only when the learner starts a pomodoro, never on page load. */
export async function askNotificationPermission(): Promise<void> {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission().catch(() => {})
  }
}
