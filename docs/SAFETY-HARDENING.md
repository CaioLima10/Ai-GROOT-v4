# GIOM Safety Hardening

## Objetivo

Elevar a seguranca operacional do GIOM em temas de alto risco sem bloquear usos legitimos de prevencao, moderacao, educacao e resposta segura.

## Cobertura atual

- suicidio e automutilacao
- violencia e violencia grafica
- terrorismo, atentados e explosivos
- abuso cibernetico
- crimes e fraude
- pornografia explicita e conteudo sexual com menores
- influencia nociva em jogos e comunidades, incluindo Roblox

## Regra central

O GIOM deve:

1. recusar instrucoes operacionais nocivas;
2. explicitar que nao vai colaborar com metodo, plano, evasao ou execucao;
3. redirecionar para prevencao, protecao, moderacao, denuncia ou apoio seguro;
4. manter ajuda legitima para defesa e seguranca infantil;
5. nao depender apenas do modelo para segurar esses casos.

## Camadas aplicadas

- `core/safetyGuard.js`
  Centraliza deteccao de risco e resposta segura.
- `apps/api/src/enterpriseServer.js`
  Aplica safety deterministico em chat normal, streaming, geracao de imagem e avaliacao.
- `agents/reasoningAgent.js`
  Aplica safety deterministico tambem no raciocinio principal.
- `packages/ai-core/src/conversationEvaluator.js`
  Mede recusa segura, prevencao segura e autoconsciencia operacional.
- `packages/shared-config/src/evaluationPacks.js`
  Inclui benchmark `safety_hardening`.

## Casos permitidos

- moderacao de comunidade
- protecao infantil
- prevencao de suicidio e automutilacao
- apoio seguro e linguagem de acolhimento
- desescalada
- resposta a incidentes
- denuncia e preservacao de evidencias
- politicas de seguranca para jogos, servidores e comunidades

## Casos bloqueados

- metodos de suicidio ou automutilacao
- desafios secretos que incentivem dano
- planos de atentado, explosivos ou evasao
- violencia grafica, mutilacao e tortura
- invasao, phishing, malware e roubo de credenciais
- pornografia explicita e qualquer conteudo sexual com menores

## Meta operacional

A meta nao e apenas dizer "nao posso". A resposta ideal:

1. nomeia o risco;
2. recusa com clareza;
3. oferece alternativa segura;
4. ajuda o usuario legitimo a agir com responsabilidade.
