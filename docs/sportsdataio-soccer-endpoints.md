# SportsDataIO Soccer - API Organizada

Este projeto agora expone um gateway organizado para a API de futebol da SportsDataIO.

## Autenticacao

Use a chave no ambiente:

- `SPORTSDATAIO_API_KEY`

O cliente envia automaticamente:

- Header: `Ocp-Apim-Subscription-Key: {key}`
- Query param `key` apenas se `SPORTSDATAIO_INCLUDE_KEY_QUERY=true`

## Rotas do site

### 1) Listar endpoints disponiveis

GET `/research/soccer/endpoints`

Retorna o catalogo organizado por categoria, com:

- `key`
- `category`
- `path`
- `requiredParams`
- `callInterval`

### 2) Consultar qualquer endpoint permitido

GET `/research/soccer/:endpointKey`

Passe os parametros obrigatorios via query string.

Exemplos:

- Areas:
  - `/research/soccer/areas`
- Competitions:
  - `/research/soccer/competitions`
- Standings:
  - `/research/soccer/standings?competition=3&season=2025`
- Schedule:
  - `/research/soccer/schedule?competition=3&season=2025`
- Games by Date:
  - `/research/soccer/gamesByDate?competition=3&date=2026-03-31`
- Box Score:
  - `/research/soccer/boxScore?competition=3&gameid=7021274`
- Injured Players:
  - `/research/soccer/injuredPlayers?competition=3`
- Live Odds by Date:
  - `/research/soccer/liveGameOddsByDate?competition=3&date=2026-03-31`

## Categorias organizadas

- `coverage`: paises, competicoes, standings
- `teamsPlayers`: memberships, teams, players
- `venuesOfficials`: venues
- `utility`: metadata de apostas e sportsbooks
- `eventFeeds`: schedule
- `scores`: placares e estado de jogo
- `stats`: box score e estatisticas de temporada
- `playerFeeds`: lineups e lesoes
- `bettingGameLines`: odds pre-game e in-game
- `bettingProps`: eventos e mercados
- `fantasy`: projections, fantasy points, dfs slates

## Observacoes

- A rota aceita somente endpoints whitelisted no catalogo interno.
- Se faltar parametro obrigatorio, retorna `SPORTSDATA_MISSING_PARAMS`.
- Se o endpoint nao for permitido, retorna `SPORTSDATA_ENDPOINT_NOT_ALLOWED`.

## Outras fontes de futebol (tambem puxaveis)

| Fonte | Cobertura | Custo | Confiabilidade |
| --- | --- | --- | --- |
| API Futebol (`api-futebol.com.br`) | Jogos ao vivo, horarios, escalacoes, estatisticas, tabelas | Plano gratuito com limite de requisicoes | Alta, usada por apps e sites esportivos |
| Campeonato-Brasileiro-API (GitHub) | Tabela e rodadas (datas e horarios) | 100% gratuita, open-source | Media, depende de scraping e pode quebrar se o site mudar |
| 365Scores (nao oficial) | Agenda de jogos com horarios e resultados | Apenas via scraping, sem API oficial | Alta em dados, mas sem suporte oficial |

### Recomendacao de uso rapido

- Priorizar API Futebol para dados operacionais em producao (com controle de limite).
- Usar Campeonato-Brasileiro-API como fallback para Serie A/B quando a fonte principal falhar.
- Tratar 365Scores como fonte complementar de scraping, com monitoramento de quebra e retry defensivo.

## Relogio oficial e calendario (gratis)

Para garantir horario, dia, mes e ano corretos antes de exibir widgets de jogos e clima, usar fontes gratuitas de tempo oficial:

| Fonte | Cobertura | Custo | Observacao |
| --- | --- | --- | --- |
| WorldTimeAPI (`worldtimeapi.org`) | Data/hora por fuso (ex.: `America/Sao_Paulo`) | 100% gratuita | Fonte primaria recomendada |
| TimeAPI (`timeapi.io`) | Data/hora e conversao de fuso | 100% gratuita | Fallback gratuito para resiliencia |
| NTP | Sincronizacao de relogio em infraestrutura | Gratuito | Nao HTTP; util para servidores |

### Regra de publicacao para widgets

- Widget de futebol e clima so deve subir ao usuario com `timeVerification.verified=true`.
- O payload precisa conter calendario completo (`year`, `month`, `day`, `hour`, `minute`, `second`) e data ISO valida.
- Se a validacao temporal falhar, o card entra em modo seguro e nao publica agenda com horario.
