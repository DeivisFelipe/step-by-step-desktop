import { create } from 'zustand'
import {
  AppSettings,
  PresenterPayload,
  RemoteCommand,
  StagePayload,
  TerminalSegment
} from '../../shared/presentation'

// Live connection to the app's presentation server (Server-Sent Events).

const params = new URLSearchParams(location.search)

/** Server base URL: the page origin, or ?server= when served by the dev server. */
export const SERVER = params.get('server') ?? location.origin
export const TOKEN = params.get('token') ?? ''
export const PARAMS = params

interface ConnectionStore {
  connected: boolean
  authorized: boolean
  /** server clock - local clock, for countdowns on other devices. */
  clockOffset: number
  presentation: AppSettings['presentation'] | null
  stage: StagePayload | null
  presenter: PresenterPayload | null
}

export const useConnection = create<ConnectionStore>(() => ({
  connected: false,
  authorized: false,
  clockOffset: 0,
  presentation: null,
  stage: null,
  presenter: null
}))

/** A change to a mirrored terminal: new output, a new size, or a full log to replay. */
export type TerminalEvent =
  | { type: 'data'; data: string }
  | { type: 'size'; cols: number; rows: number }
  | { type: 'replay' }

type TerminalListener = (id: number, event: TerminalEvent) => void
const terminalListeners = new Set<TerminalListener>()
const terminalLogs = new Map<number, TerminalSegment[]>()
const TERMINAL_BUFFER = 200_000

/** Output of an app terminal, split by the size the terminal had when it was written. */
export function terminalLog(id: number): TerminalSegment[] {
  return terminalLogs.get(id) ?? []
}

/** Subscribes to terminal changes; returns the unsubscribe function. */
export function onTerminal(listener: TerminalListener): () => void {
  terminalListeners.add(listener)
  return () => terminalListeners.delete(listener)
}

function emitTerminal(id: number, event: TerminalEvent): void {
  for (const listener of terminalListeners) listener(id, event)
}

function lastSegment(id: number): TerminalSegment {
  let log = terminalLogs.get(id)
  if (!log) {
    log = [{ cols: 80, rows: 24, data: '' }]
    terminalLogs.set(id, log)
  }
  return log[log.length - 1]
}

export function connect(): void {
  const url = `${SERVER}/events${TOKEN ? `?token=${encodeURIComponent(TOKEN)}` : ''}`
  const source = new EventSource(url)
  const json = <T>(e: Event): T => JSON.parse((e as MessageEvent).data) as T

  source.onopen = () => useConnection.setState({ connected: true })
  source.onerror = () => useConnection.setState({ connected: false })
  source.addEventListener('hello', (e) => {
    const { now, authorized } = json<{ now: number; authorized: boolean }>(e)
    useConnection.setState({ authorized, clockOffset: now - Date.now() })
  })
  source.addEventListener('config', (e) => {
    useConnection.setState({
      presentation: json<Pick<AppSettings, 'presentation'>>(e).presentation
    })
  })
  source.addEventListener('stage', (e) => useConnection.setState({ stage: json<StagePayload>(e) }))
  source.addEventListener('presenter', (e) =>
    useConnection.setState({ presenter: json<PresenterPayload>(e) })
  )
  source.addEventListener('terminal-log', (e) => {
    const { id, segments } = json<{ id: number; segments: TerminalSegment[] }>(e)
    terminalLogs.set(id, segments.length ? segments : [{ cols: 80, rows: 24, data: '' }])
    emitTerminal(id, { type: 'replay' })
  })
  source.addEventListener('terminal-size', (e) => {
    const { id, cols, rows } = json<{ id: number; cols: number; rows: number }>(e)
    const last = lastSegment(id)
    if (last.data) terminalLogs.get(id)!.push({ cols, rows, data: '' })
    else Object.assign(last, { cols, rows })
    emitTerminal(id, { type: 'size', cols, rows })
  })
  source.addEventListener('terminal', (e) => {
    const { id, data } = json<{ id: number; data: string }>(e)
    const last = lastSegment(id)
    last.data += data
    const log = terminalLogs.get(id)!
    if (log.length > 1 && log.reduce((sum, s) => sum + s.data.length, 0) > TERMINAL_BUFFER) {
      log.shift()
    } else if (last.data.length > TERMINAL_BUFFER) {
      last.data = last.data.slice(-TERMINAL_BUFFER / 2)
    }
    emitTerminal(id, { type: 'data', data })
  })
}

export async function sendCommand(command: RemoteCommand): Promise<void> {
  await fetch(`${SERVER}/api/command?token=${encodeURIComponent(TOKEN)}`, {
    method: 'POST',
    // text/plain avoids a CORS preflight when the page comes from another origin.
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(command)
  })
}
