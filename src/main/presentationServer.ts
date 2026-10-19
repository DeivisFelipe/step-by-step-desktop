import http from 'http'
import os from 'os'
import * as fs from 'fs'
import { extname, join, normalize, relative, sep } from 'path'
import { is } from '@electron-toolkit/utils'
import type { ServerInfo } from '../shared/ipc'
import {
  AppSettings,
  PRESENTATION_PAGES,
  PresenterPayload,
  RemoteCommand,
  StagePayload
} from '../shared/presentation'

// Local HTTP server for the presentation pages (OBS browser sources, presenter
// view, students). Pages receive live updates through Server-Sent Events.

const PAGES = new Set<string>([...PRESENTATION_PAGES.map((p) => p.path), 'aluno', 'apresentador'])

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
}

/** Workspace folders never served (the lesson file holds private notes). */
const PRIVATE_DIRS = new Set(['.stepbystep', '.git', 'node_modules'])

interface Client {
  res: http.ServerResponse
  authorized: boolean
}

const TERMINAL_BUFFER = 100 * 1024

export class PresentationServer {
  private server: http.Server | null = null
  private clients = new Set<Client>()
  private stage: StagePayload | null = null
  private presenter: PresenterPayload | null = null
  private terminals = new Map<number, string>()
  private terminalSizes = new Map<number, { cols: number; rows: number }>()
  private workspace: string | null = null
  private settings: AppSettings
  private port = 0
  private error: string | null = null
  private keepAlive: ReturnType<typeof setInterval> | null = null
  private infoListeners = new Set<(info: ServerInfo) => void>()

  constructor(
    settings: AppSettings,
    private rendererDir: string,
    private onCommand: (command: RemoteCommand) => void
  ) {
    this.settings = settings
  }

  onInfo(listener: (info: ServerInfo) => void): void {
    this.infoListeners.add(listener)
  }

  private emitInfo(): void {
    for (const listener of this.infoListeners) listener(this.info())
  }

  info(): ServerInfo {
    const token = this.settings.server.token
    const lanIp = this.settings.server.shareOnLan ? lanAddress() : null
    return {
      port: this.port,
      localUrl: `http://127.0.0.1:${this.port}`,
      lanUrl: lanIp && this.port ? `http://${lanIp}:${this.port}` : null,
      token,
      error: this.error
    }
  }

  async start(): Promise<void> {
    await this.stop()
    const host = this.settings.server.shareOnLan ? '0.0.0.0' : '127.0.0.1'
    const first = this.settings.server.port || 4545
    this.error = null
    for (let port = first; port < first + 20; port++) {
      try {
        await this.listen(host, port)
        this.port = port
        this.emitInfo()
        return
      } catch {
        // port in use: try the next one
      }
    }
    this.port = 0
    this.error = `Nenhuma porta livre entre ${first} e ${first + 19}.`
    this.emitInfo()
  }

  private listen(host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => this.handle(req, res))
      server.once('error', reject)
      server.listen(port, host, () => {
        server.off('error', reject)
        this.server = server
        this.keepAlive = setInterval(() => this.send(':\n\n'), 20_000)
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    if (this.keepAlive) clearInterval(this.keepAlive)
    this.keepAlive = null
    for (const client of this.clients) client.res.end()
    this.clients.clear()
    const server = this.server
    this.server = null
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()))
  }

  /** Restarts when the address changes; pushes the new style to the pages. */
  async updateSettings(settings: AppSettings): Promise<void> {
    const previous = this.settings
    this.settings = settings
    const restart =
      previous.server.port !== settings.server.port ||
      previous.server.shareOnLan !== settings.server.shareOnLan
    if (restart) await this.start()
    else {
      this.broadcast('config', this.config())
      if (previous.server.token !== settings.server.token) this.emitInfo()
    }
  }

  setWorkspace(root: string | null): void {
    this.workspace = root
  }

  publishStage(stage: StagePayload): void {
    this.stage = stage
    this.broadcast('stage', stage)
  }

  publishPresenter(presenter: PresenterPayload): void {
    this.presenter = presenter
    this.broadcast('presenter', presenter, true)
  }

  terminalData(id: number, data: string): void {
    const text = (this.terminals.get(id) ?? '') + data
    this.terminals.set(id, text.length > TERMINAL_BUFFER ? text.slice(-TERMINAL_BUFFER) : text)
    this.broadcast('terminal', { id, data })
  }

  /** The app terminal's size, so mirrors wrap lines at the same width. */
  terminalResized(id: number, cols: number, rows: number): void {
    this.terminalSizes.set(id, { cols, rows })
    this.broadcast('terminal-size', { id, cols, rows })
  }

  terminalClosed(id: number): void {
    this.terminals.delete(id)
    this.terminalSizes.delete(id)
  }

  private config(): { presentation: AppSettings['presentation'] } {
    return { presentation: this.settings.presentation }
  }

  private send(raw: string, privateOnly = false): void {
    for (const client of this.clients) {
      if (privateOnly && !client.authorized) continue
      client.res.write(raw)
    }
  }

  private broadcast(event: string, data: unknown, privateOnly = false): void {
    if (this.clients.size === 0) return
    this.send(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`, privateOnly)
  }

  private authorized(url: URL, req: http.IncomingMessage): boolean {
    const token = url.searchParams.get('token') ?? req.headers['x-ssc-token']
    return token === this.settings.server.token
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const path = decodeURIComponent(url.pathname)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'content-type, x-ssc-token')

    if (req.method === 'OPTIONS') {
      res.writeHead(204).end()
      return
    }

    if (path === '/events') return this.handleEvents(url, req, res)

    if (path === '/api/command' && req.method === 'POST') {
      if (!this.authorized(url, req)) {
        res.writeHead(403).end('token inválido')
        return
      }
      let body = ''
      req.on('data', (chunk) => (body += chunk))
      req.on('end', () => {
        try {
          this.onCommand(JSON.parse(body) as RemoteCommand)
          res.writeHead(204).end()
        } catch {
          res.writeHead(400).end()
        }
      })
      return
    }

    if (path.startsWith('/arquivos/')) return this.serveWorkspaceFile(path.slice(10), res)

    const page = path.replace(/^\/+|\/+$/g, '')
    if (page === '') return this.serveIndex(res)
    if (PAGES.has(page)) return this.servePage(page, url, res)

    if (!devServerUrl() && path.startsWith('/assets/')) {
      return this.serveFile(this.rendererDir, path.slice(1), res, 'public, max-age=3600')
    }
    res.writeHead(404).end('Não encontrado')
  }

  private handleEvents(url: URL, req: http.IncomingMessage, res: http.ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    })
    const client: Client = { res, authorized: this.authorized(url, req) }
    this.clients.add(client)
    const write = (event: string, data: unknown): void => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }
    write('hello', { now: Date.now(), authorized: client.authorized })
    write('config', this.config())
    for (const [id, size] of this.terminalSizes) write('terminal-size', { id, ...size })
    for (const [id, data] of this.terminals) write('terminal', { id, data, snapshot: true })
    if (this.stage) write('stage', this.stage)
    if (client.authorized && this.presenter) write('presenter', this.presenter)
    req.on('close', () => this.clients.delete(client))
  }

  private servePage(page: string, url: URL, res: http.ServerResponse): void {
    const dev = devServerUrl()
    if (dev) {
      // In development the page comes from the Vite server; it talks back to us.
      const params = new URLSearchParams(url.search)
      params.set('view', page)
      params.set('server', `http://127.0.0.1:${this.port}`)
      res.writeHead(302, { Location: `${dev}/overlay.html?${params}` })
      res.end()
      return
    }
    this.serveFile(this.rendererDir, 'overlay.html', res, 'no-cache')
  }

  private serveIndex(res: http.ServerResponse): void {
    const links = [
      ...PRESENTATION_PAGES.map((p) => [p.path, p.label, p.hint]),
      ['aluno', 'Alunos', 'Para a turma acompanhar pelo celular ou notebook']
    ]
      .map(([path, label, hint]) => `<li><a href="/${path}">${label}</a> — ${hint}</li>`)
      .join('')
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(
      `<!doctype html><meta charset="utf-8"><title>Step-by-Step Code</title>` +
        `<body style="font-family:system-ui;background:#111827;color:#e5e7eb;padding:32px">` +
        `<h1>Step-by-Step Code</h1><ul style="line-height:2">${links}</ul></body>`
    )
  }

  private serveWorkspaceFile(relPath: string, res: http.ServerResponse): void {
    if (!this.workspace) {
      res.writeHead(404).end()
      return
    }
    const clean = normalize(relPath).replace(/^([/\\])+/, '')
    const first = clean.split(/[/\\]/)[0]
    if (PRIVATE_DIRS.has(first)) {
      res.writeHead(403).end()
      return
    }
    this.serveFile(this.workspace, clean, res, 'no-cache')
  }

  private serveFile(root: string, relPath: string, res: http.ServerResponse, cache: string): void {
    const full = join(root, relPath)
    const rel = relative(root, full)
    if (rel.startsWith('..') || rel.startsWith(sep)) {
      res.writeHead(403).end()
      return
    }
    fs.stat(full, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404).end('Não encontrado')
        return
      }
      res.writeHead(200, {
        'Content-Type': MIME[extname(full).toLowerCase()] ?? 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': cache
      })
      fs.createReadStream(full).pipe(res)
    })
  }
}

/** Vite dev server URL when running `npm run dev`; null when serving built files. */
function devServerUrl(): string | null {
  return is.dev ? (process.env['ELECTRON_RENDERER_URL'] ?? null) : null
}

function lanAddress(): string | null {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.')) {
        return net.address
      }
    }
  }
  return null
}
