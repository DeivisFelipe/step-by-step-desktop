import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parseLessonMarkdown } from '../src/renderer/src/lib/lessonMarkdown'
import { flattenSteps } from '../src/renderer/src/lib/tree'
import type { LessonNode, StepAction } from '../src/renderer/src/types/schema'

// The example lessons shipped with the app (exemplos/): they must open, be up to date
// with their aula.md and run on Windows and Linux.

const dir = path.join(__dirname, '..', 'exemplos')
const catalog = JSON.parse(fs.readFileSync(path.join(dir, 'catalogo.json'), 'utf8')) as {
  pasta: string
  titulo: string
}[]

/** Lesson shape without ids (targets become step titles). */
function shape(tree: LessonNode[]): unknown {
  const titleOf = new Map(flattenSteps(tree).map((s) => [s.id, s.title]))
  return JSON.parse(
    JSON.stringify(tree, (key, value) =>
      key === 'id' || key === 'parentId'
        ? undefined
        : (key === 'target' || key === 'otherwise') && typeof value === 'string'
          ? titleOf.get(value)
          : value
    )
  )
}

function targets(action: StepAction): (string | undefined)[] {
  if (action.kind === 'CHOICE') return action.options.map((o) => o.target)
  if (action.kind === 'CONDITION') return [...action.rules.map((r) => r.target), action.otherwise]
  if (action.kind === 'GOTO') return [action.target]
  return []
}

describe('aulas de exemplo', () => {
  it('has several examples, each in the catalog', () => {
    const folders = fs
      .readdirSync(dir)
      .filter((name) => fs.existsSync(path.join(dir, name, '.stepbystep', 'aula.md')))
    expect(folders.length).toBeGreaterThanOrEqual(6)
    expect(catalog.map((c) => c.pasta).sort()).toEqual(folders.sort())
  })

  for (const { pasta } of catalog) {
    describe(pasta, () => {
      // Windows checkouts may turn line endings into CRLF.
      const source = fs
        .readFileSync(path.join(dir, pasta, '.stepbystep', 'aula.md'), 'utf8')
        .replace(/\r\n?/g, '\n')
      const parsed = parseLessonMarkdown(source)
      const saved = JSON.parse(
        fs.readFileSync(path.join(dir, pasta, '.stepbystep', 'lesson.json'), 'utf8')
      ) as { version: number; title: string; tree: LessonNode[] }
      const steps = flattenSteps(parsed.tree)

      it('lesson.json is up to date with aula.md (npm run exemplos)', () => {
        expect(saved.version).toBe(2)
        expect(saved.title).toBe(parsed.title)
        expect(shape(saved.tree)).toEqual(shape(parsed.tree))
      })

      it('has a title, steps and unique step titles', () => {
        expect(parsed.title).toBeTruthy()
        expect(steps.length).toBeGreaterThanOrEqual(5)
        const titles = steps.map((s) => s.title)
        expect(new Set(titles).size).toBe(titles.length)
      })

      it('every path leads to an existing step', () => {
        const arrows = (source.match(/ -> /g) ?? []).length
        const gotos = (source.match(/```irpara\n(?!```)/g) ?? []).length
        const defined = steps.flatMap((s) => s.data!.actions.flatMap(targets)).filter(Boolean)
        expect(defined.length).toBe(arrows + gotos)
      })

      it('uses commands that work on Windows and Linux', () => {
        const commands = steps
          .flatMap((s) => s.data!.actions)
          .flatMap((a) => (a.kind === 'TERMINAL' || a.kind === 'LAB' ? [a.command] : []))
        for (const command of commands) {
          expect(command).not.toMatch(/\$env:|[A-Z]:\\|\.exe\b|^\s*(dir|cls|type)\b/m)
        }
      })
    })
  }
})
