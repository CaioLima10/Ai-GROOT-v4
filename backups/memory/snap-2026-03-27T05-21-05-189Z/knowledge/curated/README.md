# Curadoria de Fontes Oficiais

Este diretório é para conteúdos **licenciados ou permitidos** (docs oficiais).

Formato recomendado para cada arquivo `.md`:
```
---
source: https://docs.exemplo.com/guia
license: permissive
title: Guia oficial
---
Conteúdo aqui...
```

Somente arquivos com `source` aprovado em `sources.json` serão ingeridos.

Para resumos internos, use `source: https://internal.local/...` e mantenha
o domínio `internal.local` em `sources.json`.
