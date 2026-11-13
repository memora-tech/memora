import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'frontend', 'dist')

const GENERIC_ENV_NAMES = new Set(['NODE_ENV', 'PORT'])
const VITE_BUILTINS = new Set(['MODE', 'BASE_URL', 'PROD', 'DEV', 'SSR'])

function parseEnvFile(filePath) {
  const entries = new Map()
  if (!fs.existsSync(filePath)) return entries
  const content = fs.readFileSync(filePath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eqIndex = line.indexOf('=')
    if (eqIndex <= 0) continue
    const key = line.slice(0, eqIndex).trim()
    let value = line.slice(eqIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    entries.set(key, value)
  }
  return entries
}

function listFilesRecursive(dir) {
  const results = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(fullPath))
    } else if (/\.(m?js|css|html|json|webmanifest|txt)$/i.test(entry.name)) {
      results.push(fullPath)
    }
  }
  return results
}

export function verifyDistDirectory(targetDistDir = distDir, root = rootDir) {
  if (!fs.existsSync(targetDistDir)) {
    throw new Error(`Diretório de build não encontrado: ${targetDistDir}`)
  }

  const exampleEntries = parseEnvFile(path.join(root, '.env.example'))
  const localEnvEntries = parseEnvFile(path.join(root, '.env'))

  const allNonViteKeys = new Set([
    'SUPABASE_URL',
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_SECRET_KEY',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GEMINI_API_KEY',
    'GEMINI_MODEL_GENERATION',
    'GEMINI_MODEL_NOA',
    'NOA_DAILY_CHAT_LIMIT',
    'ALLOW_DETERMINISTIC_AI_FALLBACK',
    'INVITE_CODE',
    'CORS_ALLOWED_ORIGIN'
  ])

  for (const key of [...exampleEntries.keys(), ...localEnvEntries.keys()]) {
    if (!key.startsWith('VITE_')) {
      allNonViteKeys.add(key)
    }
  }

  const viteValues = new Set()
  for (const [key, value] of localEnvEntries.entries()) {
    if (key.startsWith('VITE_') && value) {
      viteValues.add(value)
    }
  }

  const secretOnlyValues = []
  for (const [key, value] of localEnvEntries.entries()) {
    if (
      !key.startsWith('VITE_') &&
      !GENERIC_ENV_NAMES.has(key) &&
      value &&
      value.length >= 6 &&
      !viteValues.has(value)
    ) {
      secretOnlyValues.push({ key, value })
    }
  }

  const files = listFilesRecursive(targetDistDir)
  const violations = []

  for (const filePath of files) {
    const relPath = path.relative(root, filePath)
    const content = fs.readFileSync(filePath, 'utf8')

    for (const key of allNonViteKeys) {
      if (GENERIC_ENV_NAMES.has(key)) {
        const refRegex = new RegExp(`(?:import\\.meta\\.env|process\\.env)\\.${key}\\b`)
        if (refRegex.test(content)) {
          violations.push(`Variável sem prefixo VITE_ (${key}) referenciada em ${relPath}`)
        }
      } else {
        const keyRegex = new RegExp(`\\b${key}\\b`)
        if (keyRegex.test(content)) {
          violations.push(`Nome de variável sem prefixo VITE_ (${key}) encontrado em ${relPath}`)
        }
      }
    }

    const importMetaMatches = content.matchAll(/import\.meta\.env\.([A-Za-z0-9_]+)/g)
    for (const match of importMetaMatches) {
      const envName = match[1]
      if (!envName.startsWith('VITE_') && !VITE_BUILTINS.has(envName)) {
        violations.push(`Referência import.meta.env.${envName} sem prefixo VITE_ em ${relPath}`)
      }
    }

    for (const { key, value } of secretOnlyValues) {
      if (content.includes(value)) {
        violations.push(`Valor de variável privada (${key}) vazado em ${relPath}`)
      }
    }
  }

  if (violations.length > 0) {
    throw new Error(`Falha na verificação de segurança do bundle:\n- ${violations.join('\n- ')}`)
  }

  return { checkedFiles: files.length }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { checkedFiles } = verifyDistDirectory()
    process.stdout.write(`Verificação de bundle concluída: ${checkedFiles} arquivos inspecionados, zero variáveis sem prefixo VITE_ em frontend/dist.\n`)
  } catch (err) {
    process.stderr.write(`${err.message}\n`)
    process.exit(1)
  }
}

