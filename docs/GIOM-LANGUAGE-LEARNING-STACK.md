# GIOM Language Learning Stack

Objetivo: reduzir dificuldade do GIOM em contexto, ambiguidade, idiomas, expressao natural, feedback linguistico e limites de compreensao usando APIs gratis, recursos abertos e modelos locais.

## Problemas que precisamos atacar

1. Mudanca brusca de contexto e baixa manutencao de topico.
2. Dificuldade com expressoes idiomaticas, variantes e nuances de linguagem.
3. Ambiguidade sem desambiguacao explicita.
4. Respostas fora do limite de confianca sem declarar incerteza.
5. Linguagem natural informal sem boa normalizacao semantica.
6. Falta de feedback linguistico objetivo sobre erros, tom e adequacao.

## APIs e recursos gratis confirmados

### 1. DictionaryAPI.dev

- Site: [DictionaryAPI.dev](https://dictionaryapi.dev/)
- Endpoint base: [api.dictionaryapi.dev/api/v2/entries/en/{word}](https://api.dictionaryapi.dev/api/v2/entries/en/example)
- Custo: gratis.
- Auth: nao exige chave.
- Cobertura: definicoes, fonetica, audio, exemplos, sinonimos e antonimos quando disponiveis.
- Melhor uso no GIOM: vocabulario basico, aprendizagem lexical, explicacao curta de palavras e apoio ao nivel iniciante/intermediario.
- Limite observado na documentacao: a API se declara gratuita; nao expoe limite formal no trecho principal.
- Restricao: foco real em ingles; nao resolve sozinho idiomas, ambiguidade contextual ou idiomatismos profundos.

### 2. Datamuse API

- Site: [Datamuse API](https://www.datamuse.com/api/)
- Endpoint base: [api.datamuse.com/words](https://api.datamuse.com/words) e [api.datamuse.com/sug](https://api.datamuse.com/sug)
- Custo: gratis.
- Auth: nao exige chave.
- Cobertura: reverse dictionary, spelling similarity, sounding-like, related words, autocomplete, collocations e palavras associadas.
- Melhor uso no GIOM: desambiguacao lexical, expansao semantica, sugestao de termos, correcoes aproximadas, suporte a escrita e busca de sinonimos por contexto.
- Limite confirmado: ate 100.000 requests/dia sem chave; acima disso pode haver rate limit.
- Restricao: a parte mais forte e em ingles; algumas capacidades existem para espanhol, mas nao e uma API geral de definicoes multilanguage.

### 3. MediaWiki Action API para Wiktionary/Wikimedia

- Docs: [MediaWiki Action API](https://www.mediawiki.org/wiki/API:Main_page)
- Endpoint padrao: `https://{wiki}/w/api.php`
- Exemplos uteis:
  - Wiktionary EN: [en.wiktionary.org/w/api.php](https://en.wiktionary.org/w/api.php)
  - Wiktionary PT: [pt.wiktionary.org/w/api.php](https://pt.wiktionary.org/w/api.php)
- Custo: gratis.
- Auth: leitura publica sem login.
- Cobertura: conteudo de verbetes, etimologia, exemplos, notas de uso, expressoes idiomaticas, variantes, traducoes e paginas por idioma.
- Melhor uso no GIOM: idiomatismos, etimologia, explicacao de usos, variantes regionais, consulta multilanguage e fallback de dicionario mais rico.
- Restricao: resposta e semi-estruturada; exige parser e filtragem por idioma/sessao do verbete.
- Observacao tecnica: excelente para RAG e enriquecimento, mas ruim como unica fonte online em caminho critico sem cache.

### 4. LanguageTool Public HTTP API

- Docs: [LanguageTool HTTP API](https://languagetool.org/http-api/swagger-ui/#/default/post_check)
- Endpoint principal: POST /v2/check
- Custo: gratis no endpoint publico.
- Auth: sem chave para uso free; premium opcional.
- Cobertura: gramatica, estilo, ortografia, deteccao de idioma, sugestoes de substituicao, categorias de erro, suporte a variantes como pt-BR, pt-PT, en-US, en-GB.
- Melhor uso no GIOM: feedback linguistico, revisao de resposta, avaliacao de clareza, adequacao formal, explicacao de erros e suporte a linguagem natural informal.
- Limites confirmados no endpoint publico:
  - 20 requests/min free
  - 75.000 chars/min free
  - 20.000 chars/request free
- Restricao: endpoint publico nao e ideal para alto volume; para producao mais forte, o certo e self-host ou plano dedicado.

### 5. MyMemory Translation API

- Docs: [MyMemory Translation API](https://mymemory.translated.net/doc/spec.php)
- Endpoint principal: [api.mymemory.translated.net/get](https://api.mymemory.translated.net/get?q=ola&langpair=pt|en) com `q={texto}` e `langpair=pt|en`
- Custo: gratis com limites.
- Auth: opcional; sem chave para publico.
- Cobertura: translation memory, sugestoes de traducao, recuperacao de segmentos humanos e suporte a pares de idiomas.
- Melhor uso no GIOM: traducao auxiliar, comparacao entre variantes, memoria de traducao, exemplos bilinguais e aprendizagem intermediaria.
- Limites confirmados:
  - 5.000 chars/dia anonimo
  - 50.000 chars/dia com parametro de email valido (`de`)
  - `set` para contribuicao nao e limitado
- Restricao: nao serve como motor principal de traducao em alta escala; melhor como apoio e memoria de exemplos.

### 6. LibreTranslate

- Docs: [LibreTranslate](https://libretranslate.com/docs/)
- Endpoints principais:
  - POST /translate
  - POST /detect
  - GET /languages
  - GET /health
- Custo: open source e gratuito como software.
- Auth: depende da instancia; a documentacao publica mostra uso sem chave no modelo open source.
- Cobertura: traducao, deteccao de idioma, linguas suportadas e sugestoes.
- Melhor uso no GIOM: traducao automatica fallback, roteamento por idioma, normalizacao cross-language e experimentacao inicial.
- Restricao: a instancia publica nao deve ser assumida como infinita ou estavel para producao pesada.
- Recomendacao: se virar dependencia central, self-host.

### 7. fastText lid.176

- Docs: [fastText language identification](https://fasttext.cc/docs/en/language-identification.html)
- Tipo: modelo local, nao API remota.
- Custo: gratis.
- Licenca: CC-BY-SA 3.0 para os modelos distribuidos.
- Cobertura: identificacao de 176 idiomas.
- Melhor uso no GIOM: deteccao local de idioma antes de chamar qualquer API, roteamento por idioma, reducao de ambiguidade de locale e fallback offline.
- Vantagem: elimina latencia de rede para language ID.
- Restricao: nao corrige gramatica, nao traduz, nao resolve idiom por si so.

### 8. Mozilla Common Voice e Mozilla Data Collective

- Site: [Mozilla Common Voice](https://commonvoice.mozilla.org/en)
- Datasets: [Mozilla Data Collective](https://datacollective.mozillafoundation.org/organization/cmfh0j9o10006ns07jq45h7xk)
- Custo: gratis.
- Licenca observada nos datasets listados: CC0-1.0 em varios conjuntos.
- Cobertura: voz, texto, identificacao de idioma, fala espontanea e corpora multilanguage em larga escala.
- Melhor uso no GIOM: treinamento offline, ajuste de reconhecimento de linguagem, entendimento de linguagem coloquial e base para aprendizado do iniciante ao avancado.
- Restricao: nao e API pronta de consulta lexical; e materia-prima para treino, avaliacao e ingestao local.

## O que cada recurso resolve no problema do GIOM

| Dor | Melhor recurso | Papel principal |
| --- | --- | --- |
| Contexto e troca brusca de assunto | fastText + Datamuse + MediaWiki/Wiktionary | detectar idioma, expandir sentidos, buscar acepcoes e variantes |
| Expressoes idiomaticas | Wiktionary via MediaWiki API | idioms, usage notes, etimologia e exemplos |
| Ambiguidade lexical | Datamuse + Wiktionary | palavras relacionadas, sentido por contexto e reverse dictionary |
| Limites de compreensao | LanguageTool + camada interna de confianca | revisar saida e sinalizar quando a base nao e suficiente |
| Linguagem natural informal | LanguageTool + Common Voice + Wiktionary | normalizacao, gramatica, variantes e exemplos reais |
| Feedback linguistico | LanguageTool | explicar erro, sugerir melhoria, apontar tom e formalidade |
| Traducao e comparacao de idiomas | MyMemory + LibreTranslate | traducao fallback e memoria de traducao |
| Estudo do basico ao avancado | DictionaryAPI.dev + Wiktionary + Common Voice | basico lexical, nuances semanticas e corpus aberto |

## Stack recomendado para implementar agora

### Camada 1. Local e barata

1. fastText local para detectar idioma antes de qualquer chamada externa.
2. Cache local por termo, idioma e sentido.
3. Normalizador de texto informal antes de consultar APIs externas.

### Camada 2. Consulta lexical e semantica

1. DictionaryAPI.dev para definicao rapida em ingles.
2. Datamuse para reverse dictionary, sinonimia aproximada, spelling e collocations.
3. Wiktionary via MediaWiki API para idiomas, idioms, etimologia e notas de uso.

### Camada 3. Traducao e correcoes

1. LanguageTool para revisar entrada e saida.
2. MyMemory para traducao com memoria de exemplos.
3. LibreTranslate como fallback open source e eventual self-host.

### Camada 4. Aprendizado offline

1. Common Voice para fala e linguagem espontanea.
2. fastText e datasets abertos para classificacao de idioma e enriquecimento local.
3. RAG com verbetes curados e exemplos por nivel CEFR ou equivalente.

## Sequencia pratica de uso no runtime

1. Detectar idioma com fastText.
2. Se a pergunta for ambigua, consultar Datamuse para sentidos proximos.
3. Se pedir significado, consultar DictionaryAPI.dev ou Wiktionary.
4. Se houver idiom, regionalismo ou nuance, puxar Wiktionary via MediaWiki API.
5. Se houver erro gramatical ou pedido de melhoria de texto, passar no LanguageTool.
6. Se precisar traduzir, usar MyMemory e cair para LibreTranslate quando necessario.
7. Registrar exemplos bons em memoria local para reforco futuro.

## O que vale a pena self-host cedo

1. LibreTranslate, se traducao virar fluxo recorrente.
2. LanguageTool, se o limite publico atrapalhar.
3. Cache e parser local de Wiktionary/MediaWiki, para nao depender do parse online em toda pergunta.
4. fastText, sempre local.

## Riscos e restricoes reais

1. API gratis publica quase nunca aguenta caminho critico pesado sem cache.
2. DictionaryAPI.dev e Datamuse ajudam muito, mas nao resolvem multilanguage profundo sozinhos.
3. MyMemory tem limite diario baixo para uso anonimo.
4. Wiktionary e rico, mas exige parsing e limpeza fortes.
5. Common Voice nao e API de consulta; e dataset para treino, avaliacao e RAG offline.

## Recomendacao objetiva para o GIOM

Se for para atacar os pontos citados sem gastar agora, o melhor pacote inicial e:

1. fastText local para deteccao de idioma.
2. LanguageTool para feedback linguistico e clareza.
3. Datamuse para ambiguidade lexical, sinonimia e escrita assistida.
4. Wiktionary via MediaWiki API para idioms, etimologia e variantes.
5. MyMemory e LibreTranslate para traducao auxiliar.
6. Common Voice como base de aprendizado offline e futuro refinamento.

Esse conjunto cobre bem iniciante ao avancado sem depender de uma unica API paga.

## Como executar agora no projeto

1. Rodar auditoria do stack de linguagem:
  npm run eval:giom:language
2. Ler o relatorio gerado em:
  reports/giom-language-stack-audit.json
3. Verificar campos principais:
summary.readinessPercent
summary.failedChecks
checks (latencia e erro por servico)

## Integracao ativa no runtime

1. O fluxo principal de [apps/api/src/enterpriseServer.js](apps/api/src/enterpriseServer.js) agora injeta enriquecimento linguistico automaticamente em /ask e /ask/stream.
2. O contexto enriquecido e montado em [apps/api/src/runtimeConversationContext.js](apps/api/src/runtimeConversationContext.js).
3. O modulo responsavel pelo roteamento linguistico esta em [apps/api/src/languageRuntime.js](apps/api/src/languageRuntime.js).
4. As respostas agora expõem metadata.languageUsed para inspecao rapida de idioma, modo, servicos usados e cacheHit.

## Fallback e cache ativos

1. Traducao: MyMemory primeiro, LibreTranslate como fallback.
2. Correcao: LanguageTool com cache local por texto e idioma.
3. Lexical: DictionaryAPI para ingles, depois Wiktionary, depois Datamuse.
4. Cache local persistido em .cache/language-runtime com TTL configuravel por LANGUAGE_RUNTIME_CACHE_TTL_MS.

## Observabilidade admin

1. Status do runtime: GET /runtime/language/status
2. Limpeza de cache expirado: POST /runtime/language/cache/cleanup
3. Ambos exigem acesso admin e ajudam a verificar hit rate, providers usados e ultimo cleanup.

## Criterio de pronto para runtime

1. Readiness >= 85% com fallback definido para servicos com falha.
2. fastText local presente para roteamento offline de idioma.
3. Cache local habilitado para reduzir dependencia de API publica.
4. Se LanguageTool ou LibreTranslate virarem criticos, migrar para self-host.
