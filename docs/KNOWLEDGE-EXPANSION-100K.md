# Knowledge Expansion 100K Playbook

## Objetivo

Construir uma base local robusta no Supabase para reduzir dependencia de APIs externas, com foco em qualidade, rastreabilidade e direitos de uso.

Meta principal: 100000 registros em knowledge_embeddings com curadoria.

## Status Atual

- Total atual: verificar com npm run knowledge:audit
- Fontes principais: biblioteca privada e corpus gerado localmente
- Cobertura local (LIVROS/BIBLIAS PDF): verificar no relatorio reports/knowledge-audit.json

## Regras de Qualidade

1. Direitos: so ingerir user_provided, public_domain ou licenca explicita.
2. Clareza: texto com contexto, metodologia e exemplos.
3. Ruido: rejeitar OCR quebrado e arquivos com baixa legibilidade.
4. Duplicidade: eliminar duplicados por hash de conteudo.
5. Balanceamento: garantir distribuicao por dominios, nao apenas um tema.

## Filtro Automatizado

1. Curadoria:
   npm run knowledge:curate -- --dir knowledge/docs --min-chars 700 --min-score 70 --output reports/knowledge-curation-report.json
2. Revisao manual do relatorio:
   - acceptedAll: pronto para ingestao
   - rejectedAll: corrigir OCR/metadados/direitos

## Comandos Base

1. Auditoria:
   npm run knowledge:audit
2. Gerar pack de linguagem/comunicacao:
   npm run knowledge:generate-language-pack -- --count 1200
3. Ingerir biblioteca privada (textos/docs):
   npm run knowledge:private-library -- --dir "C:/Users/GabeG/Desktop/LIVROS" --prefix preaching-library --index-mode full --rights user_provided_or_public_domain --continue-on-error
4. Ingerir PDFs biblicos:
   npm run knowledge:pdf-library -- --dir "C:/Users/GabeG/Desktop/BIBLIAS PDF" --prefix bible-pdfs --index-mode full --continue-on-error
5. Ingerir pack de linguagem gerado:
   npm run knowledge:private-library -- --dir knowledge/docs/language-conversation-pack --prefix language-core --index-mode full --rights user_generated_internal --continue-on-error

## Plano de Escala para 100K

Fase 1 (20K -> 35K)

- Expandir language-core para 10K com curadoria e deduplicacao.
- Subir docs tecnicas de dev, OCR, PDF, RAG, arquitetura de IA.

Fase 2 (35K -> 60K)

- Adicionar corpus de teologia protestante, arqueologia biblica e pensadores cristaos com direitos validos.
- Adicionar ciencias: matematica, fisica, biologia, quimica, agro.

Fase 3 (60K -> 85K)

- Adicionar projetos e documentacoes de linguagens/programacao com licencas permissivas.
- Adicionar corpus de comunicacao internet: tom, etiqueta, interpretacao pragmatica, uso de emojis.

Fase 4 (85K -> 100K)

- Fechar lacunas por dominio.
- Recalibrar scoring de qualidade e remover ruido.
- Reprocessar embeddings de baixa qualidade.

## Distribuicao Recomendada por Dominio

- Linguagem, interpretacao e comunicacao: 20%
- Programacao, dev docs e projetos de IA: 25%
- Biblia, teologia, arqueologia e historia: 20%
- Matematica, fisica, biologia, quimica: 15%
- Agro e negocios aplicados: 10%
- Dialogo humano, etiqueta digital, emojis e contexto social: 10%

## Boas Praticas

1. Sempre versionar relatorios em reports.
2. Rodar conhecimento por lotes (1K a 5K) e auditar apos cada lote.
3. Nao misturar fontes sem metadados de direitos.
4. Priorizar qualidade sobre volume bruto.

## Observacao Sobre Astrologia

Tratar astrologia como dominio cultural/historico, nao como ciencia comprovada.
Classificar com metadata de contexto para evitar respostas factualmente enganosas.
