import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootEnvPath = path.resolve(__dirname, '../../../.env')

export function loadDevEnv() {
  if (process.env.NODE_ENV === 'production') return
  if (typeof process.loadEnvFile === 'function' && fs.existsSync(rootEnvPath)) {
    process.loadEnvFile(rootEnvPath)
  }
}

loadDevEnv()

