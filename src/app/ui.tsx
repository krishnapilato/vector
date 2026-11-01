import type { ButtonHTMLAttributes, ReactNode } from 'react'

/** The few shared building blocks. One strong action per screen; everything else is quiet. */

export function PrimaryButton({
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`min-h-12 rounded-lg bg-[var(--fg)] px-6 text-base font-medium text-[var(--bg)] disabled:opacity-40 ${className}`}
      {...props}
    />
  )
}

export function QuietButton({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`min-h-11 rounded-lg px-3 text-sm text-[var(--fg-quiet)] underline-offset-4 hover:underline ${className}`}
      {...props}
    />
  )
}

export function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex min-h-12 items-center rounded-lg bg-[var(--fg)] px-6 text-base font-medium text-[var(--bg)]"
    >
      {children}
    </a>
  )
}

export function QuietLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="text-sm text-[var(--fg-quiet)] underline underline-offset-4">
      {children}
    </a>
  )
}

export function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-medium tracking-tight">{title}</h1>
      {children}
    </div>
  )
}

export function percent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`
}
