import { describe, expect, it } from 'vitest'
import {
  basename,
  dirname,
  isInside,
  joinPath,
  languageFromPath,
  relativeTo,
  resolveInWorkspace,
  samePath
} from './paths'

describe('paths', () => {
  it('splits Windows and POSIX paths', () => {
    expect(basename('C:\\aula\\src\\a.php')).toBe('a.php')
    expect(basename('/home/aula/a.js')).toBe('a.js')
    expect(dirname('C:\\aula\\src\\a.php')).toBe('C:\\aula\\src')
  })

  it('joins with the separator of the base', () => {
    expect(joinPath('C:\\aula', 'src', 'a.php')).toBe('C:\\aula\\src\\a.php')
    expect(joinPath('/aula', 'src/a.js')).toBe('/aula/src/a.js')
  })

  it('resolves relative paths inside the workspace', () => {
    expect(resolveInWorkspace('C:\\aula', 'src/a.php')).toBe('C:\\aula\\src\\a.php')
    expect(resolveInWorkspace(null, 'a.php')).toBeNull()
    expect(relativeTo('C:\\aula', 'C:\\aula\\src\\a.php')).toBe('src/a.php')
  })

  it('compares paths ignoring case and separators on Windows', () => {
    expect(samePath('C:\\Aula\\a.php', 'c:/aula/a.php')).toBe(true)
    expect(isInside('C:\\aula\\src\\a.php', 'C:\\aula')).toBe(true)
    expect(isInside('C:\\aulas\\a.php', 'C:\\aula')).toBe(false)
  })

  it('guesses the editor language', () => {
    expect(languageFromPath('a.php')).toBe('php')
    expect(languageFromPath('a.ts')).toBe('typescript')
  })
})
