import { useEffect, useRef, useState } from 'react'

/**
 * Dictation with the browser's speech recognition. In Chrome and Edge the audio is
 * transcribed by the browser vendor's servers: the learner is told before the first use.
 */
interface RecognitionEvent {
  resultIndex: number
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
}

interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: RecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
  start(): void
  stop(): void
}

type RecognitionCtor = new () => Recognition

function ctor(): RecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const speechSupported = () => typeof window !== 'undefined' && ctor() !== null

export interface Dictation {
  listening: boolean
  /** Words not final yet. */
  interim: string
  error: string | null
  start: () => void
  stop: () => void
}

/** Final phrases are passed to onText as they arrive. */
export function useDictation(lang: string, onText: (text: string) => void): Dictation {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<Recognition | null>(null)
  const onTextRef = useRef(onText)
  onTextRef.current = onText

  useEffect(() => () => rec.current?.stop(), [])

  const start = () => {
    const C = ctor()
    if (!C) {
      setError('Questo browser non supporta la dettatura.')
      return
    }
    const r = new C()
    r.lang = lang
    r.continuous = true
    r.interimResults = true
    r.onresult = (e) => {
      let pending = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (!res) continue
        if (res.isFinal) onTextRef.current(res[0].transcript.trim())
        else pending += res[0].transcript
      }
      setInterim(pending)
    }
    r.onerror = (e) =>
      setError(
        e.error === 'not-allowed'
          ? 'Microfono non concesso.'
          : e.error === 'network'
            ? 'La dettatura richiede la connessione.'
            : e.error === 'no-speech'
              ? null
              : 'La dettatura si è interrotta.',
      )
    r.onend = () => {
      setListening(false)
      setInterim('')
    }
    rec.current = r
    setError(null)
    setListening(true)
    r.start()
  }

  return { listening, interim, error, start, stop: () => rec.current?.stop() }
}
