import { createHash } from 'crypto'
import type { ObsSettings } from '../shared/presentation'
import type { ObsStatus } from '../shared/ipc'

// Minimal obs-websocket v5 client (built into OBS Studio 28+).

const OP = { Hello: 0, Identify: 1, Identified: 2, Event: 5, Request: 6, RequestResponse: 7 }
/** EventSubscription.Scenes */
const SUBSCRIBE_SCENES = 1 << 2

interface Pending {
  resolve: (data: unknown) => void
  reject: (error: Error) => void
}

type StatusListener = (status: ObsStatus) => void

function sha256base64(text: string): string {
  return createHash('sha256').update(text).digest('base64')
}

export class ObsClient {
  private ws: WebSocket | null = null
  private config: ObsSettings | null = null
  private pending = new Map<string, Pending>()
  private nextId = 1
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private listeners = new Set<StatusListener>()
  status: ObsStatus = { enabled: false, connected: false, error: null, scenes: [] }

  onStatus(listener: StatusListener): void {
    this.listeners.add(listener)
  }

  private setStatus(patch: Partial<ObsStatus>): void {
    this.status = { ...this.status, ...patch }
    for (const listener of this.listeners) listener(this.status)
  }

  configure(config: ObsSettings): void {
    const previous = this.config
    this.config = config
    const changed =
      !previous ||
      previous.enabled !== config.enabled ||
      previous.host !== config.host ||
      previous.port !== config.port ||
      previous.password !== config.password
    if (!changed) return
    this.disconnect()
    this.setStatus({ enabled: config.enabled, connected: false, error: null, scenes: [] })
    if (config.enabled) this.connect()
  }

  private disconnect(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = null
    const ws = this.ws
    this.ws = null
    if (ws) {
      ws.onclose = null
      ws.close()
    }
    for (const p of this.pending.values()) p.reject(new Error('Desconectado do OBS'))
    this.pending.clear()
  }

  private scheduleRetry(): void {
    if (!this.config?.enabled || this.retryTimer) return
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      if (this.config?.enabled && !this.ws) this.connect()
    }, 5000)
  }

  private connect(): void {
    const config = this.config
    if (!config) return
    if (typeof WebSocket === 'undefined') {
      this.setStatus({ error: 'WebSocket indisponível neste ambiente.' })
      return
    }
    let ws: WebSocket
    try {
      ws = new WebSocket(`ws://${config.host}:${config.port}`, 'obswebsocket.json')
    } catch (e) {
      this.setStatus({ connected: false, error: (e as Error).message })
      this.scheduleRetry()
      return
    }
    this.ws = ws

    ws.onmessage = (event) => {
      let message: { op: number; d: Record<string, unknown> }
      try {
        message = JSON.parse(String(event.data))
      } catch {
        return
      }
      this.handleMessage(ws, message.op, message.d)
    }
    ws.onerror = () => {
      this.setStatus({
        connected: false,
        error: `Não foi possível conectar em ${config.host}:${config.port}. O OBS está aberto com o WebSocket ativado?`
      })
    }
    ws.onclose = (event) => {
      if (this.ws !== ws) return
      this.ws = null
      const authFailed = event.code === 4009
      this.setStatus({
        connected: false,
        error: authFailed ? 'Senha do OBS incorreta.' : this.status.error
      })
      if (!authFailed) this.scheduleRetry()
    }
  }

  private handleMessage(ws: WebSocket, op: number, d: Record<string, unknown>): void {
    if (op === OP.Hello) {
      const auth = d.authentication as { challenge: string; salt: string } | undefined
      const identify: Record<string, unknown> = {
        rpcVersion: 1,
        eventSubscriptions: SUBSCRIBE_SCENES
      }
      if (auth) {
        const secret = sha256base64((this.config?.password ?? '') + auth.salt)
        identify.authentication = sha256base64(secret + auth.challenge)
      }
      ws.send(JSON.stringify({ op: OP.Identify, d: identify }))
    } else if (op === OP.Identified) {
      this.setStatus({ connected: true, error: null })
      this.refreshScenes()
    } else if (op === OP.Event) {
      const type = String(d.eventType ?? '')
      if (/^Scene(Created|Removed|NameChanged|ListChanged)$/.test(type)) this.refreshScenes()
    } else if (op === OP.RequestResponse) {
      const id = String(d.requestId)
      const pending = this.pending.get(id)
      if (!pending) return
      this.pending.delete(id)
      const status = d.requestStatus as { result: boolean; comment?: string; code: number }
      if (status?.result) pending.resolve(d.responseData)
      else pending.reject(new Error(status?.comment || `Erro ${status?.code}`))
    }
  }

  request<T = unknown>(requestType: string, requestData?: Record<string, unknown>): Promise<T> {
    const ws = this.ws
    if (!ws || !this.status.connected) return Promise.reject(new Error('OBS não conectado'))
    const requestId = String(this.nextId++)
    return new Promise<T>((resolve, reject) => {
      this.pending.set(requestId, { resolve: resolve as (d: unknown) => void, reject })
      ws.send(JSON.stringify({ op: OP.Request, d: { requestType, requestId, requestData } }))
      setTimeout(() => {
        if (this.pending.delete(requestId)) reject(new Error('O OBS não respondeu.'))
      }, 5000)
    })
  }

  async refreshScenes(): Promise<void> {
    try {
      const data = await this.request<{ scenes: { sceneName: string; sceneIndex: number }[] }>(
        'GetSceneList'
      )
      // OBS lists scenes bottom-up; show them in the order of its UI.
      const scenes = [...data.scenes]
        .sort((a, b) => b.sceneIndex - a.sceneIndex)
        .map((s) => s.sceneName)
      this.setStatus({ scenes })
    } catch {
      // ignore: status already reflects the connection
    }
  }

  setScene(sceneName: string): void {
    this.request('SetCurrentProgramScene', { sceneName }).catch((e) =>
      this.setStatus({ error: `Cena "${sceneName}": ${(e as Error).message}` })
    )
  }

  /** Chapter marker in the recording (OBS 30.2+ with Hybrid MP4); silently ignored otherwise. */
  chapter(chapterName: string): void {
    this.request('CreateRecordChapter', { chapterName }).catch(() => {})
  }
}
