# Seguranca do GIOM

Este documento descreve as camadas atuais e recomendacoes para endurecer o ambiente.

## Camadas ja implementadas
- Headers de seguranca via `helmet` (CSP, XSS basico, etc)
- Rate limit global e específico no endpoint `/ask`
- Slow down progressivo para mitigar brute force
- HPP (proteção contra HTTP Parameter Pollution)
- CORS restrito por `ALLOWED_ORIGINS`
- `X-Powered-By` desativado
- Limite de payload configurável via `REQUEST_LIMIT`
- Admin key opcional para proteger métricas e logs
- Upload temporario com limpeza por TTL
- Redacao de dados sensiveis antes de persistir conversa, perfil, resumo, feedback e aprendizado
- Bloqueio de aprendizado persistente quando ha segredo, token, cartao, CPF, CNPJ ou dado bancario
- Sanitizacao defensiva de leitura de memoria para nao reexpor segredos antigos por prompt interno

## Dados sensiveis cobertos
- CPF e CNPJ
- Cartoes, CVV e validade
- Tokens, API keys, bearer tokens e segredos rotulados
- Dados bancarios rotulados como conta, agencia, PIX, routing, IBAN ou SWIFT
- Emails e telefones em texto livre

## Limites honestos atuais
- O sistema protege persistencia e memoria melhor do que protecao absoluta na inferencia ao vivo
- OCR depende de `UPLOAD_OCR_ENABLED=true`
- Pesquisa web ao vivo ainda nao esta integrada
- `DOCX`, `XLSX` e `PPTX` possuem extracao basica, mas Office completo ainda nao esta coberto

## Boas praticas recomendadas
- Ativar MFA no GitHub, Google, Render e Supabase
- Usar chaves de servico apenas no backend
- Rotacionar chaves periodicamente
- Ativar alertas de logs no Render e Supabase
- Separar ambientes (`dev`, `staging`, `prod`)
- Habilitar RLS e politicas estritas nas tabelas da Supabase
- Criptografar backups e revisar retencao de dados
- Revisar periodicamente quais campos do usuario realmente precisam ser persistidos

## Seguranca adicional (futuro)
- WAF (Cloudflare, AWS WAF)
- Monitoramento com SIEM
- Detecao de anomalias (suspicious IPs)
- SAST/DAST em CI
- Backup automatizado e disaster recovery
