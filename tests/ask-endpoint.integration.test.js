import test from "node:test"
import assert from "node:assert/strict"

const BASE_URL = process.env.GIOM_TEST_BASE_URL || "http://127.0.0.1:3000"
const RUN_ONLINE = process.env.RUN_ONLINE_TESTS === "true"

async function postAsk(question, context = {}) {
  const response = await fetch(`${BASE_URL}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": "integration_test_user"
    },
    body: JSON.stringify({ question, context })
  })

  const text = await response.text()
  let payload = {}
  try {
    payload = text ? JSON.parse(text) : {}
  } catch {
    payload = {}
  }

  return {
    status: response.status,
    payload,
    raw: text
  }
}

test("integration /ask should answer greeting naturally", { skip: !RUN_ONLINE }, async () => {
  const { status, payload, raw } = await postAsk("oiii", {
    channel: "integration-test",
    migrationStage: 4
  })

  assert.equal(status, 200, raw.slice(0, 200))
  const answer = String(payload?.response || payload?.answer || payload?.data?.response || "")
  assert.ok(answer.length > 0, "response should not be empty")
  assert.match(answer, /ola|oi|bom dia|boa tarde|boa noite|shalom/i)
})

test("integration /ask should not leak internal context patterns", { skip: !RUN_ONLINE }, async () => {
  const { status, payload, raw } = await postAsk("me ajuda com arquitetura", {
    channel: "integration-test",
    migrationStage: 4
  })

  assert.equal(status, 200, raw.slice(0, 200))
  const answer = String(payload?.response || payload?.answer || payload?.data?.response || "")
  assert.ok(answer.length > 0, "response should not be empty")
  assert.doesNotMatch(answer, /com o contexto que eu tenho agora/i)
  assert.doesNotMatch(answer, /topicos recentes|tópicos recentes/i)
  assert.doesNotMatch(answer, /pergunte denovo/i)
})
