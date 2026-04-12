import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "..")
const apiSrcDir = path.join(repoRoot, "apps", "api", "src")

function normalizeRegistrarName(fileName) {
  return fileName.replace(/\.(js|ts)$/u, "")
}

function extractRegistrarExports(sourceText) {
  return Array.from(sourceText.matchAll(/registerEnterprise[A-Za-z]+Routes/g), (match) => match[0]).sort()
}

const files = await fs.readdir(apiSrcDir)
const jsRegistrars = files.filter((fileName) => /^enterprise.+RoutesRuntime\.js$/u.test(fileName)).sort()
const tsRegistrars = files.filter((fileName) => /^enterprise.+RoutesRuntime\.ts$/u.test(fileName)).sort()

const jsRegistrarNames = jsRegistrars.map(normalizeRegistrarName)
const tsRegistrarNames = tsRegistrars.map(normalizeRegistrarName)

const missingTs = jsRegistrarNames.filter((name) => !tsRegistrarNames.includes(name))
const missingJs = tsRegistrarNames.filter((name) => !jsRegistrarNames.includes(name))

const sourceAggregatorText = await fs.readFile(path.join(apiSrcDir, "enterpriseRouteRegistrarsSource.js"), "utf8")
const tsAggregatorText = await fs.readFile(path.join(apiSrcDir, "enterpriseRouteRegistrars.ts"), "utf8")

const expectedExports = jsRegistrarNames
  .map((name) => name.replace(/Runtime$/u, ""))
  .map((name) => name.replace(/^enterprise/u, "registerEnterprise") + "")

const sourceExports = extractRegistrarExports(sourceAggregatorText)
const tsExports = extractRegistrarExports(tsAggregatorText)

const missingSourceExports = expectedExports.filter((name) => !sourceExports.includes(name))
const missingTsExports = expectedExports.filter((name) => !tsExports.includes(name))

assert.equal(missingTs.length, 0, `Missing TS route companions: ${missingTs.join(", ")}`)
assert.equal(missingJs.length, 0, `Missing JS route runtimes: ${missingJs.join(", ")}`)
assert.equal(missingSourceExports.length, 0, `Missing JS aggregator exports: ${missingSourceExports.join(", ")}`)
assert.equal(missingTsExports.length, 0, `Missing TS aggregator exports: ${missingTsExports.join(", ")}`)

console.log(JSON.stringify({
  jsRegistrars,
  tsRegistrars,
  aggregatorExports: {
    source: sourceExports,
    ts: tsExports
  },
  status: "ok"
}, null, 2))