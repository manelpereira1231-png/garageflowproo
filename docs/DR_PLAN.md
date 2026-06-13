# Disaster Recovery Plan — GarageFlow

## Objetivos
- **RTO** (Recovery Time Objective): 4 horas para serviço crítico (auth + ERP read).
- **RPO** (Recovery Point Objective): 5 minutos (PITR contínuo do Supabase).

## Cenários

### A. Corrupção de dados (delete acidental, bug)
1. Identificar timestamp imediatamente anterior ao incidente.
2. Lovable Cloud → suporte → solicitar PITR para `T - 1min`.
3. Validar em staging antes de promover.
4. Comunicar afetados.

### B. Indisponibilidade total de região Supabase
- Estado: dependência única; mitigação é tempo de espera do provider.
- Comunicação obrigatória: status page (`/status`) atualizado, email a todos os shops afetados.

### C. Comprometimento de credenciais (super admin, Stripe)
1. Rotação imediata via `supabase--rotate_api_keys` + Stripe restricted keys.
2. Forçar `signOut` de todos via revogação de sessões.
3. Audit log review.

## Backups
- PITR Supabase: ativo (7 dias).
- Drill de restauração: executar trimestralmente (próximo: definir).
- Exports manuais críticos: `business_metrics_daily` + `shops` mensalmente para storage externo.

## Contactos de emergência
- Super admin: manelpereira11@gmail.com
- Stripe: suporte via dashboard.
- Lovable Cloud: chat no workspace.
