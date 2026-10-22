import { app, ipcMain } from 'electron'
import * as fs from 'fs'
import { join } from 'path'
import type { ExampleInfo } from '../shared/ipc'

// Example lessons shipped with the app. They are copied to the user's Documents before
// opening, so the originals (inside the installation) stay untouched.

function examplesDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'exemplos')
    : join(app.getAppPath(), 'exemplos')
}

/** Where the copies go: Documents/Step-by-Step Code/Exemplos. */
function copiesDir(): string {
  return join(app.getPath('documents'), 'Step-by-Step Code', 'Exemplos')
}

interface CatalogEntry {
  pasta: string
  titulo: string
  descricao: string
  requer: string | null
}

function countSteps(folder: string): number {
  try {
    const lesson = JSON.parse(
      fs.readFileSync(join(folder, '.stepbystep', 'lesson.json'), 'utf8')
    ) as { tree: { children?: unknown[] }[] }
    return lesson.tree.reduce((sum, flow) => sum + (flow.children?.length ?? 0), 0)
  } catch {
    return 0
  }
}

function listExamples(): ExampleInfo[] {
  let catalog: CatalogEntry[] = []
  try {
    catalog = JSON.parse(fs.readFileSync(join(examplesDir(), 'catalogo.json'), 'utf8'))
  } catch {
    return []
  }
  return catalog
    .filter((entry) => fs.existsSync(join(examplesDir(), entry.pasta)))
    .map((entry) => {
      const copy = join(copiesDir(), entry.pasta)
      return {
        id: entry.pasta,
        title: entry.titulo,
        description: entry.descricao,
        requires: entry.requer,
        steps: countSteps(join(examplesDir(), entry.pasta)),
        copy: fs.existsSync(copy) ? copy : null
      }
    })
}

/**
 * Copies an example to Documents and returns the folder. An existing copy is reused
 * (it keeps the lesson's progress) unless `fresh`, which makes a new numbered copy.
 */
function installExample(id: string, fresh: boolean): string {
  const source = join(examplesDir(), id)
  if (!/^[\w-]+$/.test(id) || !fs.existsSync(source)) throw new Error('Exemplo não encontrado.')
  let target = join(copiesDir(), id)
  if (fs.existsSync(target) && !fresh) return target
  for (let n = 2; fs.existsSync(target); n++) target = join(copiesDir(), `${id}-${n}`)
  fs.mkdirSync(copiesDir(), { recursive: true })
  fs.cpSync(source, target, { recursive: true })
  return target
}

export function setupExamples(): void {
  ipcMain.handle('examples:list', () => listExamples())
  ipcMain.handle('examples:install', (_, id: string, fresh: boolean) => installExample(id, fresh))
}
