import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"

const root = process.cwd()

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), "utf8")
}

const [html, css, js, api, promptBuilder] = await Promise.all([
  read("apps/web/public/index.html"),
  read("apps/web/public/style.css"),
  read("apps/web/public/chat.js"),
  read("apps/api/src/enterpriseServer.js"),
  read("packages/ai-core/src/promptBuilder.js")
])

const checks = [
  {
    name: "composer keeps attachment preview inside the message area",
    run() {
      assert.match(html, /class="composer-center"/)
      assert.match(html, /<div class="file-preview hidden" id="filePreview"><\/div>[\s\S]*<textarea id="msg"/)
      assert.match(js, /function renderFilePreview\(/)
    }
  },
  {
    name: "message send flow stays wired to button and Enter key",
    run() {
      assert.match(js, /elements\.sendBtn\?\.addEventListener\("click", sendMessage\)/)
      assert.match(js, /event\.key === "Enter"[\s\S]*sendMessage\(\)/)
      assert.match(js, /async function sendMessage\(/)
    }
  },
  {
    name: "sidebar supports real open-close behavior",
    run() {
      assert.match(js, /function toggleSidebar\(force\)/)
      assert.match(js, /sidebar-collapsed/)
      assert.match(css, /sidebar-collapsed/)
    }
  },
  {
    name: "chat owns its own scroll and sticky composer",
    run() {
      assert.match(css, /\.chat-stream\s*\{[\s\S]*overflow-y:\s*auto/)
      assert.match(css, /\.composer-wrap\s*\{[\s\S]*position:\s*sticky/)
      assert.match(js, /function syncScrollButton\(/)
    }
  },
  {
    name: "backend understands uploads for pdf and image OCR",
    run() {
      assert.match(api, /app\.post\("\/upload"/)
      assert.match(api, /extractTextFromPdf/)
      assert.match(api, /extractTextFromImage/)
      assert.match(api, /visualImageUnderstanding:\s*uploadOcrEnabled/)
    }
  },
  {
    name: "assistant prompt avoids robotic self-introduction by default",
    run() {
      assert.match(promptBuilder, /nao abra com autoapresentacao/i)
      assert.match(api, /postProcessAssistantResponse/)
    }
  }
]

let failures = 0

for (const check of checks) {
  try {
    check.run()
    console.log(`PASS ${check.name}`)
  } catch (error) {
    failures += 1
    console.error(`FAIL ${check.name}`)
    console.error(error.message)
  }
}

if (failures > 0) {
  console.error(`Frontend layout test failed: ${failures} check(s) broke.`)
  process.exitCode = 1
} else {
  console.log(`Frontend layout test OK: ${checks.length} checks passed.`)
}
