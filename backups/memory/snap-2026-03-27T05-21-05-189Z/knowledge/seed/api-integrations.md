# Integração com APIs - Boas Práticas

Objetivo: garantir integrações confiáveis, seguras e fáceis de manter.

Padrões essenciais:
- Usar autenticação correta (OAuth2, API Keys, JWT)
- Respeitar rate limits e backoff exponencial
- Validar e registrar erros de resposta
- Tratar timeouts e retry com limite
- Isolar integrações por serviço

Checklist de integração:
- Variáveis de ambiente para chaves
- Logs estruturados com IDs de requisição
- Observabilidade (latência, erros, status)
- Versionamento de endpoints
- Política de atualização de SDKs

Evitar:
- Hardcode de chaves
- Requisições sem timeout
- Repetir chamadas sem cache
