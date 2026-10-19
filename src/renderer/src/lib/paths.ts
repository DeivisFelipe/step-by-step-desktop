// Small path helpers for the renderer (no Node `path` module here).

export function sepOf(path: string): string {
  return path.includes('\\') ? '\\' : '/'
}

export function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] || path
}

export function dirname(path: string): string {
  const idx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return idx > 0 ? path.slice(0, idx) : path
}

export function joinPath(base: string, ...segments: string[]): string {
  const sep = sepOf(base)
  let result = base.replace(/[\\/]+$/, '')
  for (const segment of segments) {
    for (const part of segment.split(/[\\/]+/)) {
      if (!part || part === '.') continue
      if (part === '..') result = dirname(result)
      else result = `${result}${sep}${part}`
    }
  }
  return result
}

export function isAbsolute(path: string): boolean {
  return /^([a-zA-Z]:[\\/]|[\\/])/.test(path)
}

/** Resolves a path typed by the user against the workspace root. */
export function resolveInWorkspace(root: string | null, path: string): string | null {
  const trimmed = path.trim()
  if (!trimmed) return null
  if (isAbsolute(trimmed)) return trimmed
  if (!root) return null
  return joinPath(root, trimmed)
}

function normalizeForCompare(path: string): string {
  const unified = path.replace(/\\/g, '/').replace(/\/+$/, '')
  return /^[a-zA-Z]:/.test(unified) ? unified.toLowerCase() : unified
}

export function samePath(a: string, b: string): boolean {
  return normalizeForCompare(a) === normalizeForCompare(b)
}

/** True when `child` is `parent` itself or lives somewhere inside it. */
export function isInside(child: string, parent: string): boolean {
  const c = normalizeForCompare(child)
  const p = normalizeForCompare(parent)
  return c === p || c.startsWith(`${p}/`)
}

export function relativeTo(root: string | null, path: string): string {
  if (!root || !isInside(path, root)) return path
  return path.slice(root.replace(/[\\/]+$/, '').length + 1).replace(/\\/g, '/') || '.'
}

/** Replaces the `oldPrefix` part of `path` with `newPrefix`. */
export function replacePrefix(path: string, oldPrefix: string, newPrefix: string): string {
  if (samePath(path, oldPrefix)) return newPrefix
  return newPrefix + path.slice(oldPrefix.length)
}

const LANGUAGES: Record<string, string> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  go: 'go',
  rs: 'rust',
  php: 'php',
  rb: 'ruby',
  kt: 'kotlin',
  swift: 'swift',
  dart: 'dart',
  sql: 'sql',
  html: 'html',
  htm: 'html',
  vue: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  json: 'json',
  md: 'markdown',
  xml: 'xml',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'shell',
  bash: 'shell',
  ps1: 'powershell',
  bat: 'bat',
  dockerfile: 'dockerfile',
  ini: 'ini',
  lua: 'lua',
  r: 'r'
}

export function languageFromPath(path: string | undefined): string {
  if (!path) return 'plaintext'
  const name = basename(path).toLowerCase()
  if (name === 'dockerfile') return 'dockerfile'
  const ext = name.includes('.') ? name.split('.').pop()! : ''
  return LANGUAGES[ext] || 'plaintext'
}
