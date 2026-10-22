import { app } from 'electron'
import { randomBytes } from 'crypto'
import { join } from 'path'
import * as fs from 'fs'
import {
  AppSettings,
  BUILTIN_PRESETS,
  DEFAULT_SETTINGS,
  PresentationStyle
} from '../shared/presentation'

type Listener = (settings: AppSettings, previous: AppSettings) => void

let settings: AppSettings = structuredClone(DEFAULT_SETTINGS)
const listeners = new Set<Listener>()

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Deep merge of plain objects; arrays and primitives from `patch` replace. */
function merge<T>(base: T, patch: unknown): T {
  if (!isObject(base) || !isObject(patch)) return (patch === undefined ? base : patch) as T
  const result: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    result[key] = merge((base as Record<string, unknown>)[key], value)
  }
  return result as T
}

export function loadSettings(): AppSettings {
  let saved: unknown = {}
  try {
    saved = JSON.parse(fs.readFileSync(settingsPath(), 'utf-8'))
  } catch {
    // first run or corrupt file: defaults
  }
  settings = merge(structuredClone(DEFAULT_SETTINGS), saved)
  // Built-in presets always exist; user edits of them are kept.
  settings.presentation.presets = { ...BUILTIN_PRESETS, ...settings.presentation.presets }
  // Presets saved by older versions get the options added since then.
  for (const [name, style] of Object.entries(settings.presentation.presets)) {
    settings.presentation.presets[name] = { ...BUILTIN_PRESETS.Carbon, ...style }
  }
  if (!settings.presentation.presets[settings.presentation.preset]) {
    settings.presentation.preset = 'Carbon'
  }
  if (!settings.server.token) {
    settings.server.token = randomBytes(12).toString('hex')
    persist()
  }
  return settings
}

function persist(): void {
  // Only presets the user changed are saved, so updates to the built-in ones reach them.
  const custom = Object.fromEntries(
    Object.entries(settings.presentation.presets).filter(
      ([name, style]) => JSON.stringify(style) !== JSON.stringify(BUILTIN_PRESETS[name])
    )
  )
  const data = { ...settings, presentation: { ...settings.presentation, presets: custom } }
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    fs.writeFileSync(settingsPath(), JSON.stringify(data, null, 2))
  } catch (e) {
    console.error('[settings] não foi possível salvar', e)
  }
}

function commit(next: AppSettings): AppSettings {
  const previous = settings
  settings = next
  persist()
  for (const listener of listeners) listener(settings, previous)
  return settings
}

export function getSettings(): AppSettings {
  return settings
}

export function updateSettings(patch: unknown): AppSettings {
  return commit(merge(settings, patch))
}

/** Saves (or with null, resets/removes) a whole preset. */
export function savePreset(name: string, style: PresentationStyle | null): AppSettings {
  const presets = { ...settings.presentation.presets }
  if (style) presets[name] = style
  else if (BUILTIN_PRESETS[name]) presets[name] = BUILTIN_PRESETS[name]
  else delete presets[name]
  const preset = presets[settings.presentation.preset] ? settings.presentation.preset : 'Carbon'
  return commit({ ...settings, presentation: { preset, presets } })
}

export function onSettingsChange(listener: Listener): void {
  listeners.add(listener)
}
