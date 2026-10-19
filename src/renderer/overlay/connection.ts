import { create } from 'zustand'
import {
  AppSettings,
  PresenterPayload,
  RemoteCommand,
  StagePayload
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

type TerminalListener = (id: number, data: string, snapshot: boolean) => void
const terminalListeners = new Set<TerminalListener>()
const terminalBuffers = new Map<number, string>()

/** Subscribes to terminal output; returns the unsubscribe function. */
export function onTerminal(listener: TerminalListener): () => void {
  terminalListeners.add(listener)
  return () => terminalListeners.delete(listener)
}

export function terminalBuffer(id: number): string {
  return terminalBuffers.get(id) ?? ''
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
  source.addEventListener('terminal', (e) => {
    const { id, data, snapshot } = json<{ id: number; data: string; snapshot?: boolean }>(e)
    const text = (snapshot ? '' : (terminalBuffers.get(id) ?? '')) + data
    terminalBuffers.set(id, text.length > 200_000 ? text.slice(-100_000) : text)
    for (const listener of terminalListeners) listener(id, data, !!snapshot)
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
