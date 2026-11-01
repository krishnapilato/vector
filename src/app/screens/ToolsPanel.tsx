import { useEffect, useId, useRef, useState } from 'react'
import { t } from '../i18n'
import { useStore } from '../state'
import { QuietButton } from '../ui'
import { toolsFor } from './Tools'

/** Side panel opened from a study session: tools without leaving the question. */
export function ToolsPanel({ onClose }: { onClose: () => void }) {
  const [toolId, setToolId] = useState<string>('calcolatrice')
  const { exam } = useStore()
  const tools = toolsFor(exam.aviation)
  const tool = tools.find((x) => x.id === toolId) ?? (tools[0] as (typeof tools)[number])
  const Current = tool.component
  const selectId = useId()
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('input, select')?.focus()
  }, [])

  return (
    <aside
      ref={ref}
      aria-label={t('Strumenti')}
      className="fixed inset-y-0 right-0 z-10 flex w-full max-w-md flex-col gap-6 overflow-y-auto border-l border-[var(--rule)] bg-[var(--bg)] p-6"
    >
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={selectId} className="sr-only">
          {t('Strumento')}
        </label>
        <select
          id={selectId}
          value={toolId}
          onChange={(e) => setToolId(e.target.value)}
          className="min-h-11 rounded-lg border border-[var(--rule)] bg-[var(--bg)] px-3"
        >
          {tools.map((tool) => (
            <option key={tool.id} value={tool.id}>
              {t(tool.name)}
            </option>
          ))}
        </select>
        <QuietButton onClick={onClose}>{t('Chiudi (Esc)')}</QuietButton>
      </div>
      <Current />
    </aside>
  )
}
