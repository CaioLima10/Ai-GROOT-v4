import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"

const root = process.cwd()

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), "utf8")
}

const [
  page,
  css,
  renderer,
  layout,
  enterpriseServer,
  enterpriseMediaRoutes,
  enterprisePublicRoutes,
  promptBuilder,
  chatComposer,
  chatConversation,
  chatHeader,
  chatSidebar,
  uploadExtractionRuntime
] = await Promise.all([
  read("apps/web-next/src/app/page.tsx"),
  read("apps/web-next/src/app/globals.css"),
  read("apps/web-next/src/components/messages/MessageRenderer.tsx"),
  read("apps/web-next/src/app/layout.tsx"),
  read("apps/api/src/enterpriseServer.js"),
  read("apps/api/src/enterpriseMediaRoutesRuntime.js"),
  read("apps/api/src/enterprisePublicRoutesRuntime.js"),
  read("packages/ai-core/src/promptBuilder.js"),
  read("apps/web-next/src/components/chat/ChatComposer.tsx"),
  read("apps/web-next/src/components/chat/ChatConversation.tsx"),
  read("apps/web-next/src/components/chat/ChatHeader.tsx"),
  read("apps/web-next/src/components/chat/ChatSidebar.tsx"),
  read("apps/api/src/enterpriseUploadExtractionRuntime.js")
])

const chatMarkup = [page, chatComposer, chatConversation, chatHeader, chatSidebar].join("\n")

const checks = [
  {
    name: "composer keeps attachment preview inside the message area",
    run() {
      assert.match(chatMarkup, /id="composerShell"/)
      assert.match(chatMarkup, /composer-selected-files/)
      assert.match(chatMarkup, /id="msg"/)
      assert.match(chatMarkup, /id="fileInput"/)
    }
  },
  {
    name: "message send flow stays wired to button and Enter key",
    run() {
      assert.match(chatMarkup, /onSubmit=\{submitMessage\}/)
      assert.match(chatMarkup, /onKeyDown=\{onComposerKeyDown\}/)
      assert.match(chatMarkup, /id="sendBtn"/)
    }
  },
  {
    name: "sidebar supports real open-close behavior",
    run() {
      assert.match(page, /sidebarOpen \? "sidebar-open" : "sidebar-closed"/)
      assert.match(chatMarkup, /id="mobileMenuBtn"/)
      assert.match(chatMarkup, /id="sidebarScrim"/)
      assert.match(css, /sidebar-open/)
      assert.match(css, /sidebar-closed/)
    }
  },
  {
    name: "chat owns its own scroll and sticky composer",
    run() {
      assert.match(css, /\.chat-stream\s*\{[\s\S]*overflow-y:\s*auto/)
      assert.match(css, /\.composer-shell\s*\{[\s\S]*position:\s*sticky/)
      assert.match(chatMarkup, /id="scrollBottomBtn"/)
    }
  },
  {
    name: "backend understands uploads for pdf and image OCR",
    run() {
      assert.match(enterpriseMediaRoutes, /app\.post\("\/upload"/)
      assert.match(uploadExtractionRuntime, /extractTextFromPdf/)
      assert.match(uploadExtractionRuntime, /extractTextFromImage/)
      assert.match(enterprisePublicRoutes, /visualImageUnderstanding:\s*uploadOcrEnabled/)
    }
  },
  {
    name: "assistant prompt avoids robotic self-introduction by default",
    run() {
      assert.match(promptBuilder, /nao abra com autoapresentacao/i)
      assert.match(enterpriseServer, /postProcessAssistantResponse/)
    }
  },
  {
    name: "message renderer covers rich blocks and production layout avoids remote fonts",
    run() {
      assert.match(page, /MessageRenderer/)
      assert.match(renderer, /ImageBlock/)
      assert.match(renderer, /DocumentBlock/)
      assert.doesNotMatch(layout, /next\/font\/google/)
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
