# Frontend Manual QA Checklist

## Objetivo
Checklist rapido para validar UX real do chat no desktop e mobile, cobrindo fluxo principal, anexos, scroll e acessibilidade basica.

## Pre-requisitos
1. Dependencias instaladas com `npm ci`.
2. Backend local rodando com `npm run dev`.
3. Navegadores alvo: Chrome (desktop), Safari iOS/Chrome Android (mobile real ou emulacao).

## Bloco 1 - Fluxo principal (desktop)
1. Abrir app e confirmar carregamento da tela de chat.
Esperado: chat visivel, input habilitado, botao enviar disponivel.
2. Enviar mensagem simples com Enter.
Esperado: estado visual de envio, resposta retornada, sem travar input.
3. Enviar mensagem pelo botao de enviar.
Esperado: mesmo comportamento do Enter.
4. Pressionar Enter rapidamente 3 vezes apos preencher o input.
Esperado: no maximo 1 bolha de thinking ao mesmo tempo.

## Bloco 2 - Anexos e upload
1. Anexar arquivo .txt pequeno.
Esperado: chip de anexo aparece no composer.
2. Enviar mensagem com anexo.
Esperado: chip mostra estado "Enviando..." com spinner durante upload.
3. Repetir com outro arquivo em seguida.
Esperado: segundo upload funciona e estado de upload nao fica preso no final.
4. Anexar arquivo acima do limite configurado.
Esperado: erro amigavel e sem quebrar a interface.

## Bloco 3 - Scroll e navegacao
1. Popular conversa ate gerar overflow e subir o chat para o topo.
Esperado: botao "Ir para o fim" aparece.
2. Clicar no botao "Ir para o fim".
Esperado: chat volta para o final.
3. Abrir Configuracoes pela sidebar.
Esperado: view de configuracoes abre corretamente.
4. Abrir Configuracoes pelo menu de perfil.
Esperado: view de configuracoes abre pelo caminho alternativo tambem.

## Bloco 4 - Mobile
1. Abrir em viewport 390x844.
Esperado: botao de menu mobile visivel.
2. Clicar no menu mobile para abrir sidebar.
Esperado: classe/sidebar aberta.
3. Clicar no scrim para fechar.
Esperado: sidebar fecha com consistencia.

## Bloco 5 - Acessibilidade basica
1. Navegar pelos controles principais com teclado (Tab/Shift+Tab).
Esperado: foco visivel e ordem de foco coerente.
2. Verificar input de arquivo no inspetor.
Esperado: possui nome acessivel (aria-label/title).
3. Verificar menu de perfil.
Esperado: sem conflito de role ARIA indevida para estrutura de botoes.

## Comandos de validacao automatica
1. `npm run test:frontend-layout`
2. `npm run qa:runtime`
3. `npm run qa:stress-runtime`

## Criterio de aprovacao
1. Todos os comandos automatizados devem passar.
2. Todos os passos manuais devem concluir sem regressao funcional.
