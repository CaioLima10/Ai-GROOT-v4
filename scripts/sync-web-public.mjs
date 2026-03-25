import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, "..")
const webPublicDir = path.join(projectRoot, "apps", "web", "public")
const legacyUiDir = path.join(projectRoot, "ui")

async function main() {
  await fs.mkdir(path.dirname(legacyUiDir), { recursive: true })
  await fs.rm(legacyUiDir, { recursive: true, force: true })
  await fs.cp(webPublicDir, legacyUiDir, { recursive: true, force: true })
  console.log(`Mirrored official web app: ${path.relative(projectRoot, webPublicDir)} -> ${path.relative(projectRoot, legacyUiDir)}`)
}

main().catch((error) => {
  console.error("Failed to sync web public assets:", error.message)
  process.exit(1)
})
