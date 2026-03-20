---
source: https://internal.local/bible-youversion
license: internal
title: Biblia via YouVersion API
category: bible
---
Uso recomendado:
- Buscar passagens sob demanda pela API (nao armazenar texto completo).
- Respeitar licencas de cada traducao.
- Sempre citar a versao e referencia (ex: Jo 3:16).

Fluxo basico:
- Configure YVP_APP_KEY e um bibleId padrao.
- Para outras traducoes (NAA, ARC, ARA, KJV 1611, Grego, Hebraico),
  obtenha os IDs via endpoint /v1/bibles da YouVersion.
