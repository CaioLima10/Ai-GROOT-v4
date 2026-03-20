# Segurança do GROOT

Este documento descreve as camadas atuais e recomendações para endurecer o ambiente.

## Camadas já implementadas
- Headers de segurança via `helmet` (CSP, XSS básico, etc)
- Rate limit global e específico no endpoint `/ask`
- Slow down progressivo para mitigar brute force
- HPP (proteção contra HTTP Parameter Pollution)
- CORS restrito por `ALLOWED_ORIGINS`
- `X-Powered-By` desativado
- Limite de payload configurável via `REQUEST_LIMIT`
- Admin key opcional para proteger métricas e logs

## Boas práticas recomendadas
- Ativar MFA no GitHub, Google e Supabase
- Usar chaves de serviço apenas no backend
- Rotacionar chaves periodicamente
- Ativar alertas de logs no Render/Supabase
- Separar ambientes (dev, staging, prod)

## Segurança adicional (futuro)
- WAF (Cloudflare, AWS WAF)
- Monitoramento com SIEM
- Deteção de anomalias (suspicious IPs)
- SAST/DAST em CI
- Backup automatizado e disaster recovery
