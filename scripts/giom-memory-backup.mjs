#!/usr/bin/env node
/**
 * GIOM MEMORY PROTECTION SYSTEM
 * ─────────────────────────────────────────────────────────────────
 * Protects GIOM's core memory, learning data, and knowledge base.
 * Never lose a conversation, learned pattern, or trained knowledge.
 *
 * Features:
 *   - Versioned snapshots with ISO timestamps
 *   - SHA-256 integrity checksums for every file
 *   - Automatic rotation (keeps N most recent)
 *   - Pre-deploy backup gate (blocks deploy if backup fails)
 *   - Full restore from any snapshot
 *   - Integrity verification
 *
 * Usage:
 *   node scripts/giom-memory-backup.mjs backup        # create snapshot
 *   node scripts/giom-memory-backup.mjs verify        # verify latest
 *   node scripts/giom-memory-backup.mjs list          # list all snapshots
 *   node scripts/giom-memory-backup.mjs restore <id>  # restore snapshot
 *   node scripts/giom-memory-backup.mjs pre-deploy    # backup + verify for CI
 */

import fs from "node:fs/promises"
import path from "node:path"
import crypto from "node:crypto"
import { createReadStream } from "node:fs"

const ROOT = process.cwd()
const BACKUP_ROOT = path.join(ROOT, "backups", "memory")
const MAX_SNAPSHOTS = 20

// Directories that contain GIOM's brain — never lose these
const MEMORY_SOURCES = [
  path.join(ROOT, ".groot-memory"),
  path.join(ROOT, "memory"),
  path.join(ROOT, "vectorMemory"),
  path.join(ROOT, "experience"),
  path.join(ROOT, "knowledge"),
  path.join(ROOT, "learning"),
]

async function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256")
    const stream = createReadStream(filePath)
    stream.on("data", (chunk) => hash.update(chunk))
    stream.on("end", () => resolve(hash.digest("hex")))
    stream.on("error", reject)
  })
}

async function exists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function collectFiles(dir, relBase = dir) {
  const entries = []
  if (!(await exists(dir))) return entries

  const items = await fs.readdir(dir, { withFileTypes: true })
  for (const item of items) {
    const full = path.join(dir, item.name)
    if (item.isDirectory()) {
      const sub = await collectFiles(full, relBase)
      entries.push(...sub)
    } else if (item.isFile()) {
      entries.push({ full, rel: path.relative(relBase, full) })
    }
  }
  return entries
}

async function createSnapshot() {
  await fs.mkdir(BACKUP_ROOT, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const snapshotId = `snap-${timestamp}`
  const snapshotDir = path.join(BACKUP_ROOT, snapshotId)
  await fs.mkdir(snapshotDir, { recursive: true })

  const manifest = {
    id: snapshotId,
    createdAt: new Date().toISOString(),
    files: [],
    sources: [],
    totalFiles: 0,
    totalBytes: 0,
  }

  let copiedCount = 0

  for (const source of MEMORY_SOURCES) {
    if (!(await exists(source))) continue

    const sourceName = path.basename(source)
    const destDir = path.join(snapshotDir, sourceName)
    const files = await collectFiles(source)

    if (!files.length) continue

    manifest.sources.push(sourceName)

    for (const { full, rel } of files) {
      const dest = path.join(destDir, rel)
      await fs.mkdir(path.dirname(dest), { recursive: true })
      await fs.copyFile(full, dest)

      const stat = await fs.stat(dest)
      const checksum = await sha256File(dest)

      manifest.files.push({
        source: sourceName,
        rel,
        bytes: stat.size,
        sha256: checksum,
      })

      manifest.totalBytes += stat.size
      copiedCount++
    }
  }

  manifest.totalFiles = copiedCount

  await fs.writeFile(
    path.join(snapshotDir, "MANIFEST.json"),
    JSON.stringify(manifest, null, 2),
    "utf-8"
  )

  if (copiedCount === 0) {
    await fs.rm(snapshotDir, { recursive: true, force: true })
    console.log("[BACKUP] No memory files found — GIOM memory not yet initialized.")
    return null
  }

  console.log(`[BACKUP] Snapshot created: ${snapshotId}`)
  console.log(`[BACKUP] Files protected: ${copiedCount} | Size: ${(manifest.totalBytes / 1024).toFixed(1)} KB`)
  console.log(`[BACKUP] Sources: ${manifest.sources.join(", ")}`)

  await rotateSnapshots()
  return snapshotId
}

async function rotateSnapshots() {
  const entries = await fs.readdir(BACKUP_ROOT, { withFileTypes: true })
  const snaps = entries
    .filter((e) => e.isDirectory() && e.name.startsWith("snap-"))
    .map((e) => e.name)
    .sort()

  while (snaps.length > MAX_SNAPSHOTS) {
    const oldest = snaps.shift()
    await fs.rm(path.join(BACKUP_ROOT, oldest), { recursive: true, force: true })
    console.log(`[BACKUP] Rotated old snapshot: ${oldest}`)
  }
}

async function listSnapshots() {
  if (!(await exists(BACKUP_ROOT))) {
    console.log("[BACKUP] No snapshots yet.")
    return []
  }

  const entries = await fs.readdir(BACKUP_ROOT, { withFileTypes: true })
  const snaps = entries
    .filter((e) => e.isDirectory() && e.name.startsWith("snap-"))
    .map((e) => e.name)
    .sort()
    .reverse()

  if (!snaps.length) {
    console.log("[BACKUP] No snapshots yet.")
    return []
  }

  console.log(`[BACKUP] ${snaps.length} snapshot(s) available:`)
  for (const snap of snaps) {
    const manifestPath = path.join(BACKUP_ROOT, snap, "MANIFEST.json")
    if (await exists(manifestPath)) {
      const m = JSON.parse(await fs.readFile(manifestPath, "utf-8"))
      console.log(`  ${snap} — ${m.totalFiles} files, ${(m.totalBytes / 1024).toFixed(1)} KB, ${m.createdAt}`)
    } else {
      console.log(`  ${snap} — (no manifest)`)
    }
  }
  return snaps
}

async function verifySnapshot(snapshotId) {
  let targetId = snapshotId

  if (!targetId) {
    if (!(await exists(BACKUP_ROOT))) {
      console.error("[VERIFY] No snapshots found.")
      return false
    }
    const entries = await fs.readdir(BACKUP_ROOT, { withFileTypes: true })
    const snaps = entries
      .filter((e) => e.isDirectory() && e.name.startsWith("snap-"))
      .map((e) => e.name)
      .sort()

    if (!snaps.length) {
      console.error("[VERIFY] No snapshots to verify.")
      return false
    }
    targetId = snaps[snaps.length - 1]
  }

  const snapshotDir = path.join(BACKUP_ROOT, targetId)
  const manifestPath = path.join(snapshotDir, "MANIFEST.json")

  if (!(await exists(manifestPath))) {
    console.error(`[VERIFY] Missing MANIFEST.json in ${targetId}`)
    return false
  }

  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf-8"))
  let passed = 0
  let failed = 0

  for (const entry of manifest.files) {
    const filePath = path.join(snapshotDir, entry.source, entry.rel)
    if (!(await exists(filePath))) {
      console.error(`[VERIFY] MISSING: ${entry.source}/${entry.rel}`)
      failed++
      continue
    }

    const actual = await sha256File(filePath)
    if (actual !== entry.sha256) {
      console.error(`[VERIFY] CORRUPTED: ${entry.source}/${entry.rel}`)
      failed++
    } else {
      passed++
    }
  }

  console.log(`[VERIFY] ${targetId}: ${passed} OK, ${failed} failed`)
  return failed === 0
}

async function restoreSnapshot(snapshotId) {
  const snapshotDir = path.join(BACKUP_ROOT, snapshotId)
  if (!(await exists(snapshotDir))) {
    console.error(`[RESTORE] Snapshot not found: ${snapshotId}`)
    process.exit(1)
  }

  const manifestPath = path.join(snapshotDir, "MANIFEST.json")
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf-8"))

  // Verify before restoring
  const ok = await verifySnapshot(snapshotId)
  if (!ok) {
    console.error("[RESTORE] Snapshot integrity check failed — aborting restore.")
    process.exit(1)
  }

  let restoredCount = 0
  for (const entry of manifest.files) {
    const src = path.join(snapshotDir, entry.source, entry.rel)
    const destSourceDir = MEMORY_SOURCES.find((s) => path.basename(s) === entry.source)
    if (!destSourceDir) continue

    const dest = path.join(destSourceDir, entry.rel)
    await fs.mkdir(path.dirname(dest), { recursive: true })
    await fs.copyFile(src, dest)
    restoredCount++
  }

  console.log(`[RESTORE] Restored ${restoredCount} files from ${snapshotId}`)
}

async function preDeploy() {
  console.log("[PRE-DEPLOY] Backing up GIOM memory before deploy...")
  const id = await createSnapshot()

  if (!id) {
    console.log("[PRE-DEPLOY] No memory to back up — continuing deploy.")
    process.exit(0)
  }

  const ok = await verifySnapshot(id)
  if (!ok) {
    console.error("[PRE-DEPLOY] Memory backup verification FAILED — blocking deploy.")
    process.exit(1)
  }

  console.log("[PRE-DEPLOY] GIOM memory protected. Deploy may proceed.")
  process.exit(0)
}

// ─── Main ────────────────────────────────────────────────────────────────────

const command = process.argv[2] || "backup"
const arg = process.argv[3]

switch (command) {
  case "backup":
    await createSnapshot().catch((e) => { console.error(e); process.exit(1) })
    break
  case "list":
    await listSnapshots().catch((e) => { console.error(e); process.exit(1) })
    break
  case "verify":
    {
      const ok = await verifySnapshot(arg).catch((e) => { console.error(e); process.exit(1) })
      process.exit(ok ? 0 : 1)
    }
    break
  case "restore":
    if (!arg) { console.error("Usage: restore <snapshot-id>"); process.exit(1) }
    await restoreSnapshot(arg).catch((e) => { console.error(e); process.exit(1) })
    break
  case "pre-deploy":
    await preDeploy().catch((e) => { console.error(e); process.exit(1) })
    break
  default:
    console.error(`Unknown command: ${command}`)
    process.exit(1)
}
