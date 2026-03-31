const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 70000);
const response = await fetch('http://127.0.0.1:3011/ask/stream', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-User-Id': 'copilot_validation'
  },
  body: JSON.stringify({
    question: 'Explique em termos simples o que e a Confissao de Westminster e por que ela importa na tradicao reformada.',
    context: {
      channel: 'copilot_validation',
      assistantProfile: 'concise_operator'
    }
  }),
  signal: controller.signal
});

console.log('STATUS', response.status, response.headers.get('content-type'));
if (!response.ok || !response.body) {
  console.log(await response.text().catch(() => ''));
  process.exit(1);
}

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
let chunkCount = 0;
let final = null;

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const packets = buffer.split('\n\n');
  buffer = packets.pop() || '';

  for (const packet of packets) {
    const lines = packet.split(/\r?\n/);
    let event = 'message';
    const dataLines = [];
    for (const line of lines) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    const data = dataLines.length ? JSON.parse(dataLines.join('\n')) : null;
    if (event === 'chunk') chunkCount += 1;
    if (event === 'complete') final = data;
  }
}

clearTimeout(timeout);
console.log('CHUNKS', chunkCount);
console.log('HAS_COMPLETE', Boolean(final));
if (final) {
  console.log('RESPONSE_PREVIEW', String(final.response || '').slice(0, 700));
  console.log('RAG_SOURCES', JSON.stringify(final.metadata?.ragSources || []));
  console.log('EVAL_PRESENT', Boolean(final.metadata?.evaluation));
  console.log('SELF_HEALING_PRESENT', Boolean(final.metadata?.selfHealing));
}
