---
source: https://internal.local/oauth-jwt
license: internal
title: OAuth2 e JWT - resumo interno
category: security
---
OAuth2 e padrao para autorizacao; JWT para tokens.

Pontos chave:
- Use PKCE para apps publicos.
- Access token curto e refresh token separado.
- Validar JWT: iss, aud, exp, assinatura.
- Nunca guarde tokens em localStorage se puder evitar.
