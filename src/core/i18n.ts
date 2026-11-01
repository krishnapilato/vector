/**
 * Translation plumbing shared by core and app. Italian is the source language: every
 * message is written in Italian and used as its own key; other languages map from it.
 */
export type Vars = Record<string, string | number>
export type Tr = (message: string, vars?: Vars) => string

export const fill = (message: string, vars?: Vars): string =>
  vars
    ? message.replace(/\{(\w+)\}/g, (all, k: string) => (k in vars ? String(vars[k]) : all))
    : message

/** Marks a message for translation where it is defined; translated where it is shown. */
export const msg = (message: string): string => message

/** The identity translator: Italian with variables filled in. */
export const italian: Tr = fill

export function translator(dictionary: Readonly<Record<string, string>> | null): Tr {
  return (message, vars) => fill(dictionary?.[message] ?? message, vars)
}
