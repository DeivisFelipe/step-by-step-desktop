import clsx from 'clsx'
import {
  File,
  FileCode,
  FileImage,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  LucideIcon
} from 'lucide-react'

interface FileIconProps {
  name: string
  isDirectory?: boolean
  isOpen?: boolean
  className?: string
}

const BY_EXTENSION: Record<string, [LucideIcon, string]> = {
  ts: [FileCode, 'text-blue-400'],
  tsx: [FileCode, 'text-sky-400'],
  js: [FileCode, 'text-yellow-400'],
  jsx: [FileCode, 'text-sky-300'],
  mjs: [FileCode, 'text-yellow-400'],
  cjs: [FileCode, 'text-yellow-400'],
  py: [FileCode, 'text-blue-300'],
  java: [FileCode, 'text-orange-400'],
  c: [FileCode, 'text-blue-300'],
  cpp: [FileCode, 'text-blue-400'],
  cs: [FileCode, 'text-purple-400'],
  go: [FileCode, 'text-cyan-400'],
  rs: [FileCode, 'text-orange-300'],
  php: [FileCode, 'text-indigo-300'],
  rb: [FileCode, 'text-red-400'],
  html: [FileCode, 'text-orange-500'],
  vue: [FileCode, 'text-green-400'],
  css: [FileCode, 'text-blue-300'],
  scss: [FileCode, 'text-pink-400'],
  sql: [FileCode, 'text-amber-300'],
  sh: [FileCode, 'text-green-300'],
  json: [FileJson, 'text-yellow-200'],
  md: [FileText, 'text-sky-200'],
  txt: [FileText, 'text-gray-300'],
  png: [FileImage, 'text-purple-400'],
  jpg: [FileImage, 'text-purple-400'],
  jpeg: [FileImage, 'text-purple-400'],
  gif: [FileImage, 'text-purple-400'],
  svg: [FileImage, 'text-amber-400'],
  ico: [FileImage, 'text-purple-400']
}

export const FileIcon = ({
  name,
  isDirectory,
  isOpen,
  className
}: FileIconProps): React.JSX.Element => {
  if (isDirectory) {
    const Icon = isOpen ? FolderOpen : Folder
    return <Icon size={16} className={clsx('text-[#dcb67a]', className)} />
  }
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  const [Icon, color] = BY_EXTENSION[ext] ?? [File, 'text-gray-400']
  return <Icon size={16} className={clsx(color, className)} />
}
