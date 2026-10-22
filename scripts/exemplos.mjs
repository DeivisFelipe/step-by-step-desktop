// Builds the example lessons: each exemplos/<pasta>/.stepbystep/aula.md becomes the
// lesson.json the app opens. Ids are numbered so the files only change with the lesson.
//
//   npm run exemplos                        → all examples
//   node scripts/exemplos.mjs --para-md <lesson.json>  → prints a lesson as aula.md
import { build } from 'esbuild'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { pathToFileURL } from 'url'

const root = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')),
  '..'
)
const bundle = path.join(os.tmpdir(), `ssc-lesson-markdown-${process.pid}.mjs`)
await build({
  entryPoints: [path.join(root, 'src/renderer/src/lib/lessonMarkdown.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: bundle,
  logLevel: 'error'
})
const { parseLessonMarkdown, lessonToMarkdown } = await import(pathToFileURL(bundle).href)
fs.rmSync(bundle, { force: true })

if (process.argv[2] === '--para-md') {
  const lesson = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'))
  process.stdout.write(lessonToMarkdown(lesson.tree, lesson.title))
  process.exit(0)
}

const dir = path.join(root, 'exemplos')
for (const name of fs.readdirSync(dir).sort()) {
  const source = path.join(dir, name, '.stepbystep', 'aula.md')
  if (!fs.existsSync(source)) continue
  let n = 0
  globalThis.crypto.randomUUID = () => `${name}-${++n}`
  const { title, tree } = parseLessonMarkdown(fs.readFileSync(source, 'utf8'))
  fs.writeFileSync(
    path.join(dir, name, '.stepbystep', 'lesson.json'),
    JSON.stringify({ version: 2, title, tree }, null, 2) + '\n'
  )
  const steps = tree.reduce((sum, flow) => sum + (flow.children?.length ?? 0), 0)
  console.log(`${name}: ${title} (${steps} passos)`)
}
