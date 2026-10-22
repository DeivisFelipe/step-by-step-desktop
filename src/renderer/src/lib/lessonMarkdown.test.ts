import { describe, expect, it } from 'vitest'
import { LessonNode, StepAction } from '../types/schema'
import { lessonToHandout, lessonToMarkdown, parseLessonMarkdown } from './lessonMarkdown'
import { flattenSteps } from './tree'

const SAMPLE = `---
titulo: Aula de teste
---

# Começo

## Abertura

Legenda **pública**.

> Nota: só o professor vê

\`\`\`slide transicao="zoom"
# Olá
\`\`\`

## Menu

\`\`\`escolha titulo="Qual linguagem?" variavel="trilha"
PHP -> Caminho PHP
Python -> Caminho Python
Tanto faz
\`\`\`

# Caminhos

## Caminho PHP

\`\`\`php arquivo="ola.php" operacao="criar"
<?php echo "oi";
\`\`\`

\`\`\`terminal
php ola.php
\`\`\`

\`\`\`irpara
Fim
\`\`\`

## Caminho Python

\`\`\`laboratorio arquivo="ola.py" layout="empilhado" nome="Py"
python ola.py
\`\`\`

## Conferir

\`\`\`se
saida contem "oi" -> Fim
arquivo existe "ola.php" -> Caminho PHP
arquivo contem "ola.py" "print" -> Caminho Python
variavel trilha = "PHP" -> Fim
senao -> Abertura
\`\`\`

## Fim

\`\`\`slide formato="html" telacheia="sim" transicao="wipe"
<h1 onclick="proximoPasso(0)">Tchau</h1>
\`\`\`
`

function byTitle(tree: LessonNode[], title: string): LessonNode {
  const found = flattenSteps(tree).find((s) => s.title === title)
  if (!found) throw new Error(`step ${title}`)
  return found
}

function action<K extends StepAction['kind']>(
  node: LessonNode,
  kind: K
): Extract<StepAction, { kind: K }> {
  const found = node.data?.actions.find((a) => a.kind === kind)
  if (!found) throw new Error(`no ${kind} in ${node.title}`)
  return found as Extract<StepAction, { kind: K }>
}

describe('parseLessonMarkdown', () => {
  const { title, tree } = parseLessonMarkdown(SAMPLE)

  it('reads title, flows, steps, caption and notes', () => {
    expect(title).toBe('Aula de teste')
    expect(tree.map((f) => f.title)).toEqual(['Começo', 'Caminhos'])
    const opening = byTitle(tree, 'Abertura')
    expect(opening.data!.caption).toBe('Legenda **pública**.')
    expect(opening.data!.presenterNotes).toBe('só o professor vê')
    expect(action(opening, 'SLIDE').transition).toBe('zoom')
  })

  it('resolves menu options to step ids by title', () => {
    const menu = action(byTitle(tree, 'Menu'), 'CHOICE')
    expect(menu.title).toBe('Qual linguagem?')
    expect(menu.variable).toBe('trilha')
    expect(menu.showOnStage).toBe(true)
    expect(menu.options.map((o) => o.label)).toEqual(['PHP', 'Python', 'Tanto faz'])
    expect(menu.options[0].target).toBe(byTitle(tree, 'Caminho PHP').id)
    expect(menu.options[1].target).toBe(byTitle(tree, 'Caminho Python').id)
    expect(menu.options[2].target).toBeUndefined()
  })

  it('reads go to, lab and the HTML slide', () => {
    expect(action(byTitle(tree, 'Caminho PHP'), 'GOTO').target).toBe(byTitle(tree, 'Fim').id)
    const lab = action(byTitle(tree, 'Caminho Python'), 'LAB')
    expect(lab).toMatchObject({
      targetMode: 'SPECIFIC_PATH',
      targetPath: 'ola.py',
      layout: 'vertical',
      terminal: 'Py',
      command: 'python ola.py'
    })
    const slide = action(byTitle(tree, 'Fim'), 'SLIDE')
    expect(slide.format).toBe('html')
    expect(slide.fullscreen).toBe(true)
    expect(slide.transition).toBe('wipe')
    expect(slide.html).toContain('proximoPasso(0)')
  })

  it('reads every kind of condition and the else', () => {
    const condition = action(byTitle(tree, 'Conferir'), 'CONDITION')
    expect(condition.rules.map((r) => r.test)).toEqual([
      { type: 'output-contains', text: 'oi', terminal: undefined },
      { type: 'file-exists', path: 'ola.php' },
      { type: 'file-contains', path: 'ola.py', text: 'print' },
      { type: 'variable-equals', name: 'trilha', value: 'PHP' }
    ])
    expect(condition.rules[0].target).toBe(byTitle(tree, 'Fim').id)
    expect(condition.otherwise).toBe(byTitle(tree, 'Abertura').id)
  })
})

describe('lessonToMarkdown', () => {
  it('round-trips the whole lesson, paths included', () => {
    const first = parseLessonMarkdown(SAMPLE)
    const markdown = lessonToMarkdown(first.tree, first.title)
    const second = parseLessonMarkdown(markdown)
    // Ids are new on every parse: compare by titles instead.
    const shape = (tree: LessonNode[]): unknown => {
      const titleOf = new Map(flattenSteps(tree).map((s) => [s.id, s.title]))
      return flattenSteps(tree).map((s) => ({
        title: s.title,
        caption: s.data?.caption,
        actions: s.data!.actions.map((a) =>
          JSON.parse(
            JSON.stringify(a, (key, value) =>
              key === 'id'
                ? undefined
                : (key === 'target' || key === 'otherwise') && typeof value === 'string'
                  ? titleOf.get(value)
                  : value
            )
          )
        )
      }))
    }
    expect(second.title).toBe(first.title)
    expect(shape(second.tree)).toEqual(shape(first.tree))
  })

  it('writes a target nobody can resolve as "next of the list"', () => {
    const { tree, title } = parseLessonMarkdown(
      '## A\n\n```irpara\nNão existe\n```\n\n## B\n\n```terminal\nls\n```\n'
    )
    expect(action(byTitle(tree, 'A'), 'GOTO').target).toBeUndefined()
    expect(lessonToMarkdown(tree, title)).toContain('```irpara\n\n```')
  })
})

describe('lessonToHandout', () => {
  it('lists code, commands, lab and menus for students', () => {
    const { tree, title } = parseLessonMarkdown(SAMPLE)
    const handout = lessonToHandout(tree, title, 'projeto')
    expect(handout).toContain('php ola.php')
    expect(handout).toContain('python ola.py')
    expect(handout).toContain('Qual linguagem?')
    // slide headings are demoted below the step headings
    expect(handout).toMatch(/^#### Olá$/m)
  })
})
