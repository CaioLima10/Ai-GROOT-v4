# Fale Biblico: sistema visual e organizacao de assets

## Objetivo

Organizar o mascote autoral do `Fale Biblico` para uso em `desktop/web`, sem misturar assets proprios com referencias externas do Duolingo e sem copiar a UI mobile literalmente.

Os assets organizados ficam em:

- `apps/web-next/public/branding/fale-biblico/`

O gerador reexecutavel fica em:

- `scripts/organize-fale-biblico-assets.py`

Para regenerar a biblioteca:

```powershell
python scripts/organize-fale-biblico-assets.py
```

## O que aproveitar dos PDFs

Dos tres PDFs enviados, o que mais vale aproveitar agora e:

- `Plataforma estilo Duolingo...`: caminho de aprendizagem com progresso visivel, licoes curtas, feedback imediato, ritual diario, checkpoints e pratica guiada por IA.
- `Relatorio tecnico-pedagogico...`: milestones por competencia, separacao entre linguas biblicas de leitura e idiomas com meta comunicativa, atencao a RTL/BiDi para hebraico, e uso de SRS + morfologia.
- `Requisitos e arquitetura...`: memoria, raciocinio e grounding sao importantes para a IA conversacional, mas entram como camada de plataforma, nao como decisao de branding visual.

## O que deixar de lado por agora

Para esta fase de interface e biblioteca visual, o ideal e nao priorizar:

- copiar navegacao mobile com bottom tabs;
- copiar telas do Duolingo quase literalmente;
- economia completa de hearts/energy, ligas e social graph antes do loop principal estar redondo;
- toda a arquitetura de memoria/raciocinio "big tech" antes do MVP visual e pedagogico da trilha.

## Adaptacao do estilo Duolingo para desktop/web

Principios inspirados no Duolingo que fazem sentido no desktop:

- progresso sempre visivel;
- modulos curtos e objetivos claros;
- mascote reagindo com emocao e estado pedagogico;
- reforco de habito diario;
- feedback rapido apos cada acao;
- revisao espacada embutida na trilha.

Adaptacao recomendada para `desktop/web`:

- coluna esquerda: navegacao e modos;
- centro: trilha principal com unidades, checkpoints e revisoes;
- direita ou painel lateral: tutor/mascote, voz em tempo real, dicas e explicacoes;
- mais densidade informacional do que no mobile, mas com hierarquia visual forte;
- suportar teclado, hover, focus, arrastar menos e clicar mais;
- tratar hebraico com `dir="rtl"` e muito cuidado em blocos mistos `pt-BR + hebraico`.

## Estrutura criada

```text
apps/web-next/public/branding/fale-biblico/
  manifest.json
  source-sheets/
    alphabet-board.png
    emotion-viseme-board.png
    hero-scribe.png
    pose-board.png
    viseme-board-extended.png
  sprites/
    emotions/
    hero/
    letters/
    lipsync/
    poses/
```

## Criterios de organizacao

Os assets foram separados com foco em uso de produto:

- `letters`: personagens/variantes por letra para alfabetos, onboarding e blocos didaticos.
- `lipsync`: visemas para sincronizacao de boca em voz/TTS/STT.
- `emotions`: estados emocionais para feedback, celebracao, erro, duvida e descanso.
- `poses`: poses maiores para hero areas, cards, telas vazias e estados de licao.
- `hero`: versao principal do mascote para cabecalhos, landing e painel do tutor.

## Convencoes de naming

- nomes em `kebab-case`;
- categorias pensadas por uso, nao por nome original do arquivo;
- assets autorais versionados no projeto;
- referencias externas do Duolingo tratadas apenas como inspiracao visual e nao publicadas em `public/`.

## Referencias externas mantidas fora do bundle

As imagens de referencia do Duolingo que voce enviou foram deliberadamente mantidas fora de `public/` para nao misturar material de terceiros com o pacote do produto. Elas continuam uteis como benchmark visual:

- `Menu-duolingo-768x487.jpg`
- `OIP.webp`
- `OIP (2).webp`
- `tai-duolingo-tren-may-tinh-8-1.jpg`
- `widgets--1-.png`

## Fontes oficiais usadas para orientar a adaptacao

- Duolingo blog sobre a evolucao dos cursos e alinhamento por nivel: `https://blog.duolingo.com/duolingo-updates/`
- Duolingo blog sobre a nova trilha de aprendizagem e espacamento de revisao: `https://blog.duolingo.com/how-well-does-duolingo-teach-english/`
- Duolingo blog sobre Friend Streak e motivacao social: `https://blog.duolingo.com/product-lessons-friend-streak/`
- Duolingo blog sobre o sistema de Energy: `https://blog.duolingo.com/duolingo-energy/`
- Duolingo blog sobre treino de pronuncia por sons: `https://blog.duolingo.com/duolingo-english-sounds-tab/`

## Proximos passos recomendados

- usar `sprites/hero/scribe-default.png` no cabecalho do painel `Fale Biblico`;
- escolher 3 a 5 emocoes canonicas do mascote para o MVP;
- ligar `lipsync` ao fluxo de voz em tempo real;
- criar um painel desktop com trilha central + tutor lateral, em vez de espelhar a navegacao mobile;
- definir um guia de estados do mascote: `idle`, `listening`, `speaking`, `celebrating`, `confused`, `warning`, `resting`.
