import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ gfm: true, breaks: true })

/** Markdown → sanitized HTML (captions, slides and challenges). */
export function renderMarkdown(markdown: string): string {
  const html = marked.parse(markdown ?? '', { async: false }) as string
  return DOMPurify.sanitize(html, { ADD_ATTR: ['target'] })
}
