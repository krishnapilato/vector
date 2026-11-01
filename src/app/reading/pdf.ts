import type { PDFDocumentProxy } from 'pdfjs-dist'
import { chaptersFromOutline } from '../../core/reading/book'
import { itemsToText, type TextItem } from '../../core/reading/text'

/**
 * PDF import with pdf.js, loaded only when needed. Everything runs in the browser:
 * the file is read locally and never uploaded anywhere.
 */

async function pdfjs() {
  const lib = await import('pdfjs-dist')
  if (!lib.GlobalWorkerOptions.workerSrc) {
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    lib.GlobalWorkerOptions.workerSrc = worker.default
  }
  return lib
}

export interface OpenPdf {
  doc: PDFDocumentProxy
  close: () => Promise<void>
}

export async function openPdf(data: ArrayBuffer): Promise<OpenPdf> {
  const lib = await pdfjs()
  // pdf.js transfers the buffer to its worker: give it a copy so the caller's stays usable.
  const task = lib.getDocument({ data: new Uint8Array(data.slice(0)) })
  return { doc: await task.promise, close: () => task.destroy() }
}

interface RawTextItem {
  str: string
  transform: number[]
  width: number
  height: number
}

export async function pageText(doc: PDFDocumentProxy, pageNumber: number): Promise<string> {
  const page = await doc.getPage(pageNumber)
  const content = await page.getTextContent()
  const items: TextItem[] = (content.items as unknown[])
    .filter((i): i is RawTextItem => typeof (i as RawTextItem).str === 'string')
    .map((i) => ({
      str: i.str,
      x: i.transform[4] ?? 0,
      y: i.transform[5] ?? 0,
      width: i.width,
      height: i.height || Math.hypot(i.transform[2] ?? 0, i.transform[3] ?? 0) || 10,
    }))
  page.cleanup()
  return itemsToText(items)
}

/** Top-level outline entries with the page they point to. */
async function outline(doc: PDFDocumentProxy): Promise<{ title: string; page: number }[]> {
  const entries = (await doc.getOutline()) ?? []
  const out: { title: string; page: number }[] = []
  for (const e of entries) {
    try {
      const dest = typeof e.dest === 'string' ? await doc.getDestination(e.dest) : e.dest
      const ref = Array.isArray(dest) ? dest[0] : null
      if (ref && typeof ref === 'object') {
        out.push({ title: e.title, page: (await doc.getPageIndex(ref)) + 1 })
      } else if (typeof ref === 'number') {
        out.push({ title: e.title, page: ref + 1 })
      }
    } catch {
      // A broken outline entry is skipped, never fatal.
    }
  }
  return out
}

export interface ImportedPdf {
  title: string | null
  pageCount: number
  pages: string[]
  chapters: ReturnType<typeof chaptersFromOutline>
}

export async function importPdf(
  data: ArrayBuffer,
  onProgress: (done: number, total: number) => void,
): Promise<ImportedPdf> {
  const { doc, close } = await openPdf(data)
  try {
    const pages: string[] = []
    for (let n = 1; n <= doc.numPages; n++) {
      pages.push(await pageText(doc, n))
      onProgress(n, doc.numPages)
    }
    const meta = await doc.getMetadata().catch(() => null)
    const title = (meta?.info as { Title?: string } | undefined)?.Title?.trim() || null
    return {
      title,
      pageCount: doc.numPages,
      pages,
      chapters: chaptersFromOutline(await outline(doc), doc.numPages),
    }
  } finally {
    await close()
  }
}

/** Plain text and Markdown: pages of about 3000 characters, cut at paragraph boundaries. */
export function importText(text: string, pageSize = 3000): { pages: string[] } {
  const paras = text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const pages: string[] = []
  let current: string[] = []
  let size = 0
  for (const p of paras) {
    if (size + p.length > pageSize && current.length > 0) {
      pages.push(current.join('\n\n'))
      current = []
      size = 0
    }
    current.push(p)
    size += p.length
  }
  if (current.length > 0) pages.push(current.join('\n\n'))
  return { pages: pages.length > 0 ? pages : [''] }
}

/** Renders one page of a stored PDF to a canvas, fitted to the given CSS width. */
export async function renderPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  cssWidth: number,
): Promise<{ width: number; height: number }> {
  const page = await doc.getPage(pageNumber)
  const base = page.getViewport({ scale: 1 })
  const scale = cssWidth / base.width
  const ratio = window.devicePixelRatio || 1
  const viewport = page.getViewport({ scale: scale * ratio })
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  canvas.style.width = `${Math.floor(viewport.width / ratio)}px`
  canvas.style.height = `${Math.floor(viewport.height / ratio)}px`
  await page.render({ canvas, viewport }).promise
  page.cleanup()
  return { width: viewport.width / ratio, height: viewport.height / ratio }
}
