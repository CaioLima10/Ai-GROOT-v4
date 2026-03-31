# GIOM RAG Evolution Blueprint

## Scope

This blueprint evolves GIOM at the system layer only.

- Keep base LLM unchanged.
- Keep current runtime paths intact.
- Extend RAG, memory, orchestration, and prompt composition.
- Preserve GIOM personality already implemented.

## 1. Architecture

Target layered architecture:

1. System Prompt Layer
2. Memory Layer (short + long term)
3. RAG Layer (retrieve + rerank)
4. Orchestrator Layer (decision engine)
5. LLM Layer (provider call)

Connection flow:

1. User input enters orchestrator.
2. Orchestrator classifies intent.
3. Orchestrator decides memory and RAG usage.
4. Prompt builder composes final prompt with bounded size.
5. LLM responds.
6. Feedback and interaction summary update memory and knowledge.

## 2. System Prompt Design

Design goals:

- Keep GIOM intelligent, useful, adaptive.
- Keep respectful, clear, empathetic behavior.
- Allow tone adaptation (formal/informal) by context.
- Keep Christian value basis without forcing beliefs.
- Never expose private internal identity data automatically.

Implementation status:

- Global runtime prompt already updated in core/aiProviders.js.
- Profile and internal identity aligned in config/aiProfile.js and coreIdentity/identity.js.

## 3. RAG Design

### 3.1 Data Structure (JSON)

Required fields per record:

- tema
- conteudo
- explicacao
- contexto_uso
- tags

Sample file added:

- knowledge/seed/giom-rag-knowledge-samples.json

### 3.2 Knowledge Types

Coverage:

- Conversational examples
- General knowledge
- Programming
- Biblical contextual knowledge
- Problem solving playbooks

### 3.3 Retrieval Strategy

Pipeline:

1. Embed query.
2. Retrieve candidate set.
3. Apply top-k (3 to 5 default).
4. Rerank by relevance + domain match.
5. Inject only compact relevant chunks.

Rules:

- Never send entire knowledge base.
- Deduplicate semantically similar chunks.
- Keep only actionable context.

## 4. Memory System

Two memory horizons:

- Short-term: current conversation turns.
- Long-term: user preferences, recurring topics, stable facts.

Suggested schema:

- nome
- interesses
- historico_resumido
- contexto_recente

When to save:

- After successful answer completion.
- On explicit preference statement.
- On stable identity fact with confidence threshold.

When to use:

- If question references prior context.
- If user asks continuity/follow-up.
- If response style preferences are known.

## 5. Orchestrator Logic

New module added:

- packages/ai-core/src/giomOrchestrator.js
- re-exported by core/giomOrchestrator.js and packages/ai-core/src/index.js

Flow implemented:

1. Receive question.
2. Classify intent.
3. Decide strategy (RAG vs memory vs direct).
4. Build contextual prompt package.
5. Compose final prompt with token/size guard.
6. Return plan object ready for LLM call.

## 6. Final Prompt Composition

Standard prompt shape:

- [ System Prompt ]
- [ Memoria relevante ]
- [ Contexto do RAG ]
- [ Pergunta do usuario ]

Rules enforced:

- Section-level truncation.
- Overall max prompt size.
- Relevance-first context ordering.

## 7. Training Simulation Dataset

Dialogue simulation file added:

- knowledge/seed/giom-training-simulated-dialogues.jsonl

Includes variation by:

- tone
- context
- complexity
- expected response behavior

## 8. Advanced Behavior Targets

Teach GIOM to:

- Adapt language by user profile and intent.
- Explain step-by-step when needed.
- Be direct for urgent asks.
- Use moderate humor only when context permits.
- Avoid generic responses by grounding in memory + RAG.

## 9. Safety and Robustness

Required controls:

- Input validation and sanitization.
- Safe fallback responses for provider failures.
- No internal/private data leakage.
- No hard crash path on retrieval/provider failure.

Current alignment:

- Existing safety and privacy guards already present.
- New orchestrator is additive and non-breaking.

## 10. Continuous Evolution

Feedback loop:

1. Capture interaction outcome.
2. Score quality and safety.
3. Save useful patterns only.
4. Promote validated knowledge to RAG.
5. Re-run retrieval quality checks.

Recommended practical rollout:

1. Keep current runtime call path.
2. A/B test orchestrator-built prompt vs current prompt in shadow mode.
3. Track win metrics: helpfulness, latency, fallback rate, error rate.
4. Switch default only after stable improvement.

## Developer Quick Start

1. Import and use giomOrchestrator:

```js
import { giomOrchestrator } from "../core/giomOrchestrator.js"

const plan = await giomOrchestrator.buildResponsePlan(userQuestion, {
  userId,
  activeModules,
  bibleStudyModules,
  conversationHistory,
  userStyle: "natural"
})

const promptToLLM = plan.finalPrompt
```

1. Keep existing aiProviders call unchanged.
1. Log plan.strategy for observability.
1. Use provided seed datasets to bootstrap retrieval quality.
