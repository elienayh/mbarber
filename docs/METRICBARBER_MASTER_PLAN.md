# PLANO MESTRE DE ARQUITETURA E ENGENHARIA — METRICBARBER

> **SaaS de Gestão e Agendamento para Barbearias**  
> **Referência Funcional:** Estrutura e fluxos observados no InBarber (com engenharia própria, moderna, segura e multi-tenant)  
> **Stack:** Lovable, GitHub, Supabase (PostgreSQL, Auth, RLS, Storage, Edge Functions), Stripe, Tailwind CSS, TypeScript.

---

## 1. VISÃO GERAL DO PRODUTO

O **MetricBarber** é uma plataforma SaaS multi-tenant concebida para modernizar a gestão operacional, financeira e de relacionamento de barbearias de qualquer porte. A plataforma resolve simultaneamente as três pontas do ecossistema:
1. **Administração Global do SaaS (Nível 1 - Super Admin):** Gestão comercial, métricas financeiras (MRR, Churn, LTV), faturamento via Stripe, gestão de tenants, auditoria e suporte operacional.
2. **Backoffice da Barbearia (Nível 2 - Tenant):** Operação diária da barbearia: agenda dinâmica em tempo real, gestão de múltiplos profissionais, serviços com duração e preços configuráveis, controle de clientes, financeiro integrado (receitas, despesas, comissões), controle de estoque e relatórios analíticos.
3. **Experiência do Cliente Final (Nível 3 - Agendamento Público Conversacional):** Interface conversacional (chat web responsivo e amigável para mobile) acessível via link público exclusivo (`metricbarber.com.br/{slug-barbearia}`). O cliente agenda sem necessidade de baixar aplicativo ou criar senha complexa, com reconhecimento inteligente de retorno via número de telefone/WhatsApp.

---

## 2. ARQUITETURA GLOBAL DO SISTEMA

```
                              ┌────────────────────────────────────────────────────────┐
                              │                    CAMADA DE CLIENTES                  │
                              └────────────────────────────────────────────────────────┘
                                      │                            │
                     ┌────────────────┴──────────────┐   ┌─────────┴────────────────┐
                     │    Navegador Web / Mobile     │   │   Navegador Mobile       │
                     │  (Backoffice SaaS & Tenant)   │   │ (Chat Público do Cliente)│
                     └───────────────────────────────┘   └──────────────────────────┘
                                      │                            │
                                      ▼                            ▼
                              ┌────────────────────────────────────────────────────────┐
                              │           FRONTEND SPA (Vite + React + TS)             │
                              │           Hospedado via Lovable / Vercel               │
                              │    - TanStack Query (cache de dados e revalidação)     │
                              │    - Zustand / Context (estados de sessão e UI)        │
                              │    - Tailwind CSS + Radix UI / Shadcn                  │
                              └────────────────────────────────────────────────────────┘
                                      │                            │
                     ┌────────────────┴──────────────┐   ┌─────────┴────────────────┐
                     │  Supabase Client (Autenticado)│   │ Supabase Client (Anônimo)│
                     │   JWT com Tenant Claims       │   │ Invocação de RPCs Seguras│
                     └───────────────────────────────┘   └──────────────────────────┘
                                      │                            │
                                      ▼                            ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                               SUPABASE PLATFORM (BACKEND & POSTGRESQL)                       │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│   ┌─────────────────────┐    ┌─────────────────────┐    ┌────────────────────────────────┐   │
│   │    Supabase Auth    │    │ Supabase Storage    │    │    Edge Functions (Deno/TS)    │   │
│   │  (Email/Senha,      │    │ (Logos, Avatares,   │    │  - stripe-webhook (idempotente)│   │
│   │   Magic Link, RLS)  │    │  Fotos de Serviços) │    │  - stripe-checkout-session     │   │
│   └─────────────────────┘    └─────────────────────┘    │  - stripe-portal               │   │
│                                                         │  - send-notifications-job      │   │
│                                                         │  - calculate-availability-rpc  │   │
│                                                         │  - process-recurring-series    │   │
│                                                         └────────────────────────────────┘   │
│                                                                          │                   │
│   ┌──────────────────────────────────────────────────────────────────────┴───────────────┐   │
│   │                                POSTGRESQL 15+ MOTOR PRINCIPAL                        │   │
│   │  - Row Level Security (RLS) habilitado em 100% das tabelas operacionais             │   │
│   │  - Triggers de auditoria, cálculo automático e validação de conflito de agenda       │   │
│   │  - Extensions: `pgcrypto` (UUIDs), `pg_trgm` (busca textual), `pg_cron` (rotinas)   │   │
│   └─────────────────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                                      │                            │
                                      ▼                            ▼
                      ┌──────────────────────────────┐   ┌───────────────────────────┐
                      │        STRIPE BILLING        │   │ NOTIFICAÇÕES (MENSAGERIA) │
                      │ - Subscriptions & Checkout   │   │ - WhatsApp API Provider   │
                      │ - Webhooks (event-driven)    │   │ - E-mail Transacional     │
                      └──────────────────────────────┘   └───────────────────────────┘
```

---

## 3. SEPARAÇÃO ESTRUTURAL DE NÍVEIS (MÓDULOS)

### Nível 1: Plataforma MetricBarber (SaaS Admin)
- Gestão de Tenants (onboarding, bloqueio, cancelamento, alteração manual de status).
- Gestão de Planos & Preços (limites de profissionais, recursos liberados, vínculo com Stripe Price IDs).
- Monitoramento de Assinaturas e Inadimplência (MRR, Churn, tentativas de cobrança).
- Auditoria Global de Acessos e Ações Críticas.
- Painel de Suporte (visualização operacional de suporte sem violar privacidade desnecessária).

### Nível 2: Barbearia (Tenant Backoffice)
- **Dashboard Operacional:** Atendimentos do dia, taxa de ocupação de cadeiras, faturamento estimado, alertas de estoque baixo.
- **Agenda Multivisualização:** Visualização diária em colunas por profissional e visualização semanal; reagendamento por drag-and-drop ou modal; bloqueio de horários.
- **Profissionais:** Cadastro, escalas de trabalho individuais, intervalos de almoço, comissões personalizadas por serviço, vinculação a usuário do sistema.
- **Serviços:** Categorias, duração em minutos, tempo de tolerância/buffer, valores e profissionais habilitados.
- **Clientes:** Livro de clientes com histórico de agendamentos, faltas, receitas geradas e identificação por WhatsApp.
- **Financeiro:** Fluxo de caixa diário/mensal, separação de receitas de serviços e vendas de produtos, controle de comissões de barbeiros e despesas fixas.
- **Estoque:** Produtos para consumo interno e para revenda na bancada, alerta de estoque mínimo e registro de perdas/entradas.
- **Relatórios:** Produtividade por barbeiro, serviços mais lucrativos, taxa de no-show (faltas) e clientes inativos.
- **Configurações:** Horários da barbearia, endereço, personalização do slug público, identidade visual (logo e cores) e políticas de cancelamento.

### Nível 3: Chat Público de Agendamento (Mobile-First)
- Acesso sem necessidade de download via `metricbarber.com.br/{slug}`.
- Interface conversacional guiada em etapas (State Machine interativa):
  1. Boas-vindas personalizadas com branding da barbearia.
  2. Escolha de serviço(s).
  3. Escolha do profissional ("Qualquer disponível" ou profissional de preferência).
  4. Seleção de data (calendário intuitivo).
  5. Seleção de horário livre (calculado em tempo real, sem risco de conflito).
  6. Identificação do cliente (Nome + Celular/WhatsApp).
  7. Confirmação instantânea com geração de link de acompanhamento e opção de adicionar ao Google Calendar.

---

## 4. ARQUITETURA MULTI-TENANT & POLÍTICA DE ISOLAMENTO (RLS)

### Estratégia de Isolamento: Shared Database, Shared Schema (Tenant Discriminator)
- Todas as tabelas de dados operacionais contêm obrigatoriamente a coluna `tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT`.
- O isolamento **NUNCA** é delegado ao frontend (`WHERE tenant_id = ...` na query da interface é apenas conveniência; a garantia inviolável é imposta pelo PostgreSQL RLS).

### Mecanismo de Identificação de Tenant na Sessão
1. Cada usuário logado possui um registro em `tenant_users` associando seu `auth.uid()` ao `tenant_id` e a um `role` específico.
2. Função PostgreSQL `auth.tenant_id()` e `auth.user_role()`:
   Criamos funções de banco que inspecionam o token JWT ou consultam a tabela de associação com cache na sessão.
3. Para otimização de alta escala no Supabase, utilizamos um **Custom Claims Hook** do Supabase Auth: ao emitir o JWT, o payload conterá:
   ```json
   {
     "app_metadata": {
       "tenant_id": "8fa8d1b2-1324-4632-986c-7e6dfb4c2b9a",
       "role": "owner"
     }
   }
   ```
4. Se o usuário for Administrador da Plataforma (`super_admin`), `app_metadata.is_platform_admin = true`, concedendo acesso através de políticas dedicadas de bypass supervisionado.

---

## 5. HIERARQUIA DE USUÁRIOS & PERMISSÕES (RBAC)

### Papéis da Plataforma (SaaS Level)
- `super_admin`: Acesso total à administração do MetricBarber, criação de planos, gestão de cobranças, cancelamentos forçados e auditoria.
- `platform_admin`: Gestão diária de barbearias, acompanhamento de suporte e relatórios de plataforma.
- `support_agent`: Acesso somente leitura para diagnóstico operacional mediante solicitação do cliente.

### Papéis do Tenant (Barbearia Level)
- `owner` (Proprietário): Acesso irrestrito a todos os dados do tenant, dados financeiros, configurações de pagamento, gestão de planos e convite de funcionários.
- `admin` (Gerente): Acesso a agenda completa, estoque, relatórios operacionais, clientes e cadastro de serviços. Sem permissão para excluir a barbearia ou alterar titularidade da assinatura Stripe.
- `professional` (Barbeiro): Acesso restrito à sua própria agenda, seus próprios clientes agendados, seu relatório individual de comissões e marcação de status do atendimento. Bloqueado de ver faturamento global da barbearia ou dados de outros barbeiros.
- `receptionist` (Recepcionista): Acesso a agendamentos de todos os profissionais, cadastro de clientes e recebimento no caixa diário. Bloqueado de ver relatórios gerenciais consolidados e configurações de conta.

### Matriz Completa de Permissões

| Recurso / Ação | Super Admin | Owner (Proprietário) | Admin (Gerente) | Receptionist (Caixa) | Professional (Barbeiro) | Cliente Público (Anônimo) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Gerenciar Tenants (Criar/Bloquear)** | ✅ Total | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Configurações da Barbearia & Slug** | ✅ Total | ✅ Total | ⚠️ Parcial | ❌ | ❌ | ❌ |
| **Assinatura SaaS & Stripe Portal** | ✅ Total | ✅ Total | ❌ | ❌ | ❌ | ❌ |
| **Visualizar Agenda Global** | 🔍 Auditoria | ✅ Total | ✅ Total | ✅ Total | ⚠️ Apenas a sua | ❌ |
| **Criar/Editar Agendamento (Interno)** | ❌ | ✅ Total | ✅ Total | ✅ Total | ⚠️ Na sua agenda | ❌ |
| **Criar Agendamento (Público)** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Via RPC Chat |
| **Cancelar Agendamento** | 🔍 Auditoria | ✅ Total | ✅ Total | ✅ Total | ⚠️ Seus horários | ⚠️ Apenas o seu |
| **Ver Faturamento da Barbearia** | ✅ Total | ✅ Total | ⚠️ Operacional | ❌ | ❌ | ❌ |
| **Ver Própria Comissão** | ❌ | ✅ Total | ✅ Total | ❌ | ✅ Apenas a sua | ❌ |
| **Gerenciar Estoque (Entrada/Ajuste)** | ❌ | ✅ Total | ✅ Total | ⚠️ Venda balcão | ❌ | ❌ |
| **Editar Preços e Serviços** | ❌ | ✅ Total | ✅ Total | ❌ | ❌ | ❌ |
| **Editar Horários de Trabalho** | ❌ | ✅ Total | ✅ Total | ❌ | ⚠️ Solicitar/Bloq | ❌ |
| **Acessar Base de Clientes (LGPD)** | 🔍 Auditoria | ✅ Total | ✅ Total | ✅ Operacional | ⚠️ Só quem atendeu| ❌ |

---

## 6. MODELAGEM RELACIONAL COMPLETA DO SUPABASE POSTGRESQL

Todas as chaves primárias são `UUID` com default `gen_random_uuid()`. Timestamps sempre `TIMESTAMPTZ` com default `now()`.

### Diagrama Entidade-Relacionamento Conceitual

```
┌──────────────┐       1:N      ┌──────────────────┐       1:N      ┌──────────────────────┐
│    plans     │───────────────<│  subscriptions   │>───────────────┤       tenants        │
└──────────────┘                └──────────────────┘                └──────────────────────┘
                                                                               │
          ┌───────────────────────────┬────────────────────────────────────────┼────────────────────────────┐
          │ 1:N                       │ 1:N                                    │ 1:N                        │ 1:N
          ▼                           ▼                                        ▼                            ▼
┌──────────────────┐        ┌──────────────────┐                     ┌───────────────────┐        ┌───────────────────┐
│   tenant_users   │        │     services     │                     │   professionals   │        │     customers     │
└──────────────────┘        └──────────────────┘                     └───────────────────┘        └───────────────────┘
          │                           │                                        │                            │
          │                           │ 1:N                                    │ 1:N                        │
          │                           ▼                                        ▼                            │
          │                 ┌──────────────────────────────────────────────────────┐                        │
          │                 │                professional_services                 │                        │
          │                 └──────────────────────────────────────────────────────┘                        │
          │                                            │                                                    │
          │                                            │ N:1                                                │
          ▼                                            ▼                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                  appointments                                                   │
│                        (tenant_id, customer_id, professional_id, service_id, start_time, ...)                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
          │                                                                    │
          ▼ 1:1 (quando faturado)                                              ▼ N:1
┌──────────────────────────────────┐                                 ┌───────────────────┐
│      financial_transactions      │                                 │ appointment_series│
└──────────────────────────────────┘                                 └───────────────────┘
```

### Especificação de Tabelas e Campos

#### 1. `tenants` (Barbearias / Assinantes)
- `id` (UUID, PK)
- `slug` (VARCHAR(60), UNIQUE, NOT NULL, INDEX) — Ex: `barbearia-vintage`
- `name` (VARCHAR(150), NOT NULL) — Razão Social / Nome de Registro
- `trade_name` (VARCHAR(150), NOT NULL) — Nome Fantasia exibido ao cliente
- `document_number` (VARCHAR(20)) — CNPJ ou CPF
- `phone` (VARCHAR(20), NOT NULL) — WhatsApp de contato da barbearia
- `email` (VARCHAR(150), NOT NULL)
- `address_street` (VARCHAR(200))
- `address_number` (VARCHAR(20))
- `address_neighborhood` (VARCHAR(100))
- `address_city` (VARCHAR(100))
- `address_state` (VARCHAR(2))
- `address_zip_code` (VARCHAR(10))
- `logo_url` (TEXT)
- `primary_color` (VARCHAR(7), DEFAULT '#1E293B')
- `secondary_color` (VARCHAR(7), DEFAULT '#E2E8F0')
- `status` (ENUM `tenant_status`: `trial`, `active`, `past_due`, `suspended`, `canceled`, DEFAULT 'trial')
- `trial_ends_at` (TIMESTAMPTZ, NOT NULL)
- `settings` (JSONB, DEFAULT '{"allow_client_cancel_hours": 2, "slot_interval_minutes": 30, "send_reminders_hours_before": 2}')
- `created_at` (TIMESTAMPTZ, DEFAULT now())
- `updated_at` (TIMESTAMPTZ, DEFAULT now())

#### 2. `plans` (Catálogo de Planos do MetricBarber)
- `id` (UUID, PK)
- `name` (VARCHAR(100), NOT NULL) — Ex: "Plano Individual", "Plano Barbearia Pro"
- `slug` (VARCHAR(50), UNIQUE, NOT NULL)
- `description` (TEXT)
- `stripe_product_id` (VARCHAR(100), NOT NULL)
- `stripe_price_id` (VARCHAR(100), NOT NULL)
- `price_cents` (INTEGER, NOT NULL) — Ex: 7900 para R$ 79,00
- `billing_cycle` (ENUM `billing_cycle`: `monthly`, `quarterly`, `yearly`)
- `max_professionals` (INTEGER, NOT NULL) — Limite da cota
- `features` (JSONB, DEFAULT '{"reports": true, "inventory": true, "whatsapp_alerts": true}')
- `is_active` (BOOLEAN, DEFAULT true)
- `created_at` (TIMESTAMPTZ, DEFAULT now())

#### 3. `subscriptions` (Assinaturas SaaS via Stripe)
- `id` (UUID, PK)
- `tenant_id` (UUID, UNIQUE, NOT NULL, FK -> `tenants.id` ON DELETE RESTRICT)
- `plan_id` (UUID, NOT NULL, FK -> `plans.id`)
- `stripe_customer_id` (VARCHAR(100), NOT NULL, INDEX)
- `stripe_subscription_id` (VARCHAR(100), NOT NULL, UNIQUE, INDEX)
- `status` (ENUM `subscription_status`: `trialing`, `active`, `past_due`, `canceled`, `unpaid`, `incomplete`)
- `current_period_start` (TIMESTAMPTZ, NOT NULL)
- `current_period_end` (TIMESTAMPTZ, NOT NULL)
- `cancel_at_period_end` (BOOLEAN, DEFAULT false)
- `canceled_at` (TIMESTAMPTZ)
- `created_at` (TIMESTAMPTZ, DEFAULT now())
- `updated_at` (TIMESTAMPTZ, DEFAULT now())

#### 4. `profiles` (Usuários de Autenticação - Plataforma & Tenants)
- `id` (UUID, PK, FK -> `auth.users.id` ON DELETE CASCADE)
- `email` (VARCHAR(150), NOT NULL)
- `full_name` (VARCHAR(150), NOT NULL)
- `avatar_url` (TEXT)
- `is_platform_admin` (BOOLEAN, DEFAULT false)
- `platform_role` (VARCHAR(50)) — `super_admin`, `platform_admin`, `support`
- `created_at` (TIMESTAMPTZ, DEFAULT now())
- `updated_at` (TIMESTAMPTZ, DEFAULT now())

#### 5. `tenant_users` (Associação Usuário ↔ Barbearia)
- `id` (UUID, PK)
- `tenant_id` (UUID, NOT NULL, FK -> `tenants.id` ON DELETE CASCADE, INDEX)
- `user_id` (UUID, NOT NULL, FK -> `profiles.id` ON DELETE CASCADE, INDEX)
- `role` (ENUM `tenant_role`: `owner`, `admin`, `professional`, `receptionist`, DEFAULT 'professional')
- `is_active` (BOOLEAN, DEFAULT true)
- `created_at` (TIMESTAMPTZ, DEFAULT now())
- `UNIQUE(tenant_id, user_id)`

#### 6. `professionals` (Profissionais da Tesoura / Barba)
- `id` (UUID, PK)
- `tenant_id` (UUID, NOT NULL, FK -> `tenants.id` ON DELETE CASCADE, INDEX)
- `user_id` (UUID, FK -> `profiles.id` ON DELETE SET NULL) — Vínculo opcional se o barbeiro não tiver login
- `name` (VARCHAR(150), NOT NULL)
- `nickname` (VARCHAR(50))
- `phone` (VARCHAR(20))
- `email` (VARCHAR(150))
- `avatar_url` (TEXT)
- `bio` (TEXT)
- `commission_rate` (NUMERIC(5,2), DEFAULT 50.00) — Percentual padrão de comissão
- `color_hex` (VARCHAR(7), DEFAULT '#3B82F6') — Cor da agenda
- `is_active` (BOOLEAN, DEFAULT true)
- `display_order` (INTEGER, DEFAULT 0)
- `created_at` (TIMESTAMPTZ, DEFAULT now())
- `updated_at` (TIMESTAMPTZ, DEFAULT now())

#### 7. `services` (Catálogo de Serviços da Barbearia)
- `id` (UUID, PK)
- `tenant_id` (UUID, NOT NULL, FK -> `tenants.id` ON DELETE CASCADE, INDEX)
- `name` (VARCHAR(100), NOT NULL) — Ex: "Corte Degradê", "Barba Terapia"
- `description` (TEXT)
- `category` (VARCHAR(50), DEFAULT 'Cabelo')
- `price_cents` (INTEGER, NOT NULL) — Ex: 4500 (R$ 45,00)
- `duration_minutes` (INTEGER, NOT NULL) — Ex: 30, 45, 60
- `buffer_minutes` (INTEGER, DEFAULT 0) — Tempo de limpeza/intervalo pós-serviço
- `is_active` (BOOLEAN, DEFAULT true)
- `image_url` (TEXT)
- `created_at` (TIMESTAMPTZ, DEFAULT now())
- `updated_at` (TIMESTAMPTZ, DEFAULT now())

#### 8. `professional_services` (Habilitação de Barbeiro por Serviço)
- `id` (UUID, PK)
- `tenant_id` (UUID, NOT NULL, FK -> `tenants.id` ON DELETE CASCADE)
- `professional_id` (UUID, NOT NULL, FK -> `professionals.id` ON DELETE CASCADE)
- `service_id` (UUID, NOT NULL, FK -> `services.id` ON DELETE CASCADE)
- `custom_price_cents` (INTEGER) — Preço diferenciado para este barbeiro (opcional)
- `custom_duration_minutes` (INTEGER) — Duração diferenciada (opcional)
- `custom_commission_rate` (NUMERIC(5,2)) — Comissão diferenciada para este serviço (opcional)
- `created_at` (TIMESTAMPTZ, DEFAULT now())
- `UNIQUE(professional_id, service_id)`

#### 9. `business_hours` (Horário Geral de Funcionamento da Barbearia)
- `id` (UUID, PK)
- `tenant_id` (UUID, NOT NULL, FK -> `tenants.id` ON DELETE CASCADE)
- `day_of_week` (INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6)) — 0=Dom, 1=Seg, ..., 6=Sáb
- `open_time` (TIME NOT NULL) — Ex: '09:00'
- `close_time` (TIME NOT NULL) — Ex: '20:00'
- `break_start` (TIME) — Ex: '12:00'
- `break_end` (TIME) — Ex: '13:00'
- `is_closed` (BOOLEAN, DEFAULT false)
- `created_at` (TIMESTAMPTZ, DEFAULT now())
- `UNIQUE(tenant_id, day_of_week)`

#### 10. `professional_schedules` (Escala Específica do Profissional)
- `id` (UUID, PK)
- `tenant_id` (UUID, NOT NULL, FK -> `tenants.id` ON DELETE CASCADE)
- `professional_id` (UUID, NOT NULL, FK -> `professionals.id` ON DELETE CASCADE)
- `day_of_week` (INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6))
- `start_time` (TIME NOT NULL)
- `end_time` (TIME NOT NULL)
- `break_start` (TIME)
- `break_end` (TIME)
- `is_day_off` (BOOLEAN, DEFAULT false)
- `created_at` (TIMESTAMPTZ, DEFAULT now())
- `UNIQUE(professional_id, day_of_week)`

#### 11. `schedule_blocks` (Bloqueios / Ausências / Folgas)
- `id` (UUID, PK)
- `tenant_id` (UUID, NOT NULL, FK -> `tenants.id` ON DELETE CASCADE)
- `professional_id` (UUID, FK -> `professionals.id` ON DELETE CASCADE) — Se NULL, bloqueia a barbearia toda (ex: feriado)
- `title` (VARCHAR(150), NOT NULL) — Ex: "Consulta Médica", "Manutenção Ar-condicionado"
- `start_time` (TIMESTAMPTZ, NOT NULL)
- `end_time` (TIMESTAMPTZ, NOT NULL)
- `is_all_day` (BOOLEAN, DEFAULT false)
- `created_at` (TIMESTAMPTZ, DEFAULT now())

#### 12. `customers` (Cadastro de Clientes do Tenant)
- `id` (UUID, PK)
- `tenant_id` (UUID, NOT NULL, FK -> `tenants.id` ON DELETE CASCADE, INDEX)
- `name` (VARCHAR(150), NOT NULL)
- `phone` (VARCHAR(20), NOT NULL, INDEX) — Chave primordial de identificação
- `email` (VARCHAR(150))
- `notes` (TEXT) — Observações de atendimento ("prefere máquina 1 na lateral")
- `total_appointments` (INTEGER, DEFAULT 0)
- `total_spent_cents` (BIGINT, DEFAULT 0)
- `last_appointment_at` (TIMESTAMPTZ)
- `is_blocked` (BOOLEAN, DEFAULT false) — Proteção contra spam/trolls
- `created_at` (TIMESTAMPTZ, DEFAULT now())
- `updated_at` (TIMESTAMPTZ, DEFAULT now())
- `UNIQUE(tenant_id, phone)` — Impede duplicações de cliente na mesma barbearia

#### 13. `appointment_series` (Séries de Agendamento Recorrente)
- `id` (UUID, PK)
- `tenant_id` (UUID, NOT NULL, FK -> `tenants.id` ON DELETE CASCADE)
- `customer_id` (UUID, NOT NULL, FK -> `customers.id`)
- `professional_id` (UUID, NOT NULL, FK -> `professionals.id`)
- `service_id` (UUID, NOT NULL, FK -> `services.id`)
- `frequency` (ENUM `recurrence_frequency`: `weekly`, `biweekly`, `monthly`)
- `day_of_week` (INTEGER)
- `preferred_time` (TIME NOT NULL)
- `start_date` (DATE NOT NULL)
- `end_date` (DATE)
- `total_occurrences` (INTEGER, NOT NULL)
- `status` (ENUM `series_status`: `active`, `completed`, `canceled`, DEFAULT 'active')
- `created_at` (TIMESTAMPTZ, DEFAULT now())

#### 14. `appointments` (Agendamentos Operacionais)
- `id` (UUID, PK)
- `tenant_id` (UUID, NOT NULL, FK -> `tenants.id` ON DELETE CASCADE, INDEX)
- `series_id` (UUID, FK -> `appointment_series.id` ON DELETE SET NULL)
- `series_index` (INTEGER) — Posição da série (ex: 2 de 8)
- `customer_id` (UUID, NOT NULL, FK -> `customers.id` ON DELETE RESTRICT, INDEX)
- `professional_id` (UUID, NOT NULL, FK -> `professionals.id` ON DELETE RESTRICT, INDEX)
- `service_id` (UUID, NOT NULL, FK -> `services.id` ON DELETE RESTRICT)
- `start_time` (TIMESTAMPTZ, NOT NULL, INDEX)
- `end_time` (TIMESTAMPTZ, NOT NULL, INDEX)
- `duration_minutes` (INTEGER, NOT NULL)
- `price_cents` (INTEGER, NOT NULL)
- `commission_rate` (NUMERIC(5,2), NOT NULL)
- `commission_cents` (INTEGER NOT NULL GENERATED ALWAYS AS (ROUND((price_cents * commission_rate) / 100)) STORED)
- `status` (ENUM `appointment_status`: `scheduled`, `confirmed`, `in_progress`, `completed`, `canceled`, `no_show`, `rescheduled`, DEFAULT 'scheduled')
- `origin` (ENUM `appointment_origin`: `public_chat`, `backoffice`, `recurrent`, DEFAULT 'public_chat')
- `cancellation_reason` (TEXT)
- `canceled_by` (VARCHAR(50)) — `client`, `barber`, `admin`, `system`
- `notes` (TEXT)
- `created_at` (TIMESTAMPTZ, DEFAULT now())
- `updated_at` (TIMESTAMPTZ, DEFAULT now())

#### 15. `financial_transactions` (Livro Caixa e Conciliação)
- `id` (UUID, PK)
- `tenant_id` (UUID, NOT NULL, FK -> `tenants.id` ON DELETE CASCADE, INDEX)
- `appointment_id` (UUID, UNIQUE, FK -> `appointments.id` ON DELETE SET NULL)
- `type` (ENUM `transaction_type`: `income`, `expense`)
- `category` (ENUM `financial_category`: `service_revenue`, `product_sale`, `commission_payout`, `rent`, `utilities`, `supplies`, `software`, `marketing`, `other`)
- `amount_cents` (INTEGER, NOT NULL)
- `payment_method` (ENUM `payment_method`: `money`, `pix`, `credit_card`, `debit_card`, `transfer`, `voucher`, DEFAULT 'pix')
- `status` (ENUM `transaction_status`: `pending`, `paid`, `canceled`, DEFAULT 'paid')
- `description` (VARCHAR(255), NOT NULL)
- `professional_id` (UUID, FK -> `professionals.id` ON DELETE SET NULL) — Vínculo quando for comissão ou atendimento
- `paid_at` (TIMESTAMPTZ, DEFAULT now())
- `due_date` (DATE)
- `created_at` (TIMESTAMPTZ, DEFAULT now())

#### 16. `products` (Estoque e Vendas de Balcão)
- `id` (UUID, PK)
- `tenant_id` (UUID, NOT NULL, FK -> `tenants.id` ON DELETE CASCADE, INDEX)
- `name` (VARCHAR(150), NOT NULL) — Ex: "Pomada Modeladora Efeito Matte"
- `sku` (VARCHAR(50))
- `barcode` (VARCHAR(50))
- `category` (VARCHAR(50), DEFAULT 'Pomadas')
- `cost_price_cents` (INTEGER, NOT NULL DEFAULT 0)
- `sale_price_cents` (INTEGER, NOT NULL)
- `current_stock` (INTEGER, NOT NULL DEFAULT 0)
- `min_stock_alert` (INTEGER, NOT NULL DEFAULT 3)
- `is_active` (BOOLEAN, DEFAULT true)
- `created_at` (TIMESTAMPTZ, DEFAULT now())
- `updated_at` (TIMESTAMPTZ, DEFAULT now())

#### 17. `stock_movements` (Histórico de Movimentações de Estoque)
- `id` (UUID, PK)
- `tenant_id` (UUID, NOT NULL, FK -> `tenants.id` ON DELETE CASCADE)
- `product_id` (UUID, NOT NULL, FK -> `products.id` ON DELETE CASCADE)
- `type` (ENUM `stock_movement_type`: `in_purchase`, `out_sale`, `out_internal_use`, `out_loss_expired`, `adjustment`)
- `quantity` (INTEGER, NOT NULL)
- `unit_cost_cents` (INTEGER)
- `notes` (TEXT)
- `created_by` (UUID, FK -> `profiles.id`)
- `created_at` (TIMESTAMPTZ, DEFAULT now())

#### 18. `notification_logs` (Fila e Auditoria de Notificações e Lembretes)
- `id` (UUID, PK)
- `tenant_id` (UUID, NOT NULL, FK -> `tenants.id` ON DELETE CASCADE)
- `appointment_id` (UUID, FK -> `appointments.id` ON DELETE CASCADE)
- `channel` (ENUM `notification_channel`: `whatsapp`, `email`, `sms`, `push`)
- `event` (ENUM `notification_event`: `created`, `confirmed`, `reminder`, `canceled`, `rescheduled`)
- `recipient_phone` (VARCHAR(20))
- `recipient_name` (VARCHAR(150))
- `message_body` (TEXT, NOT NULL)
- `status` (ENUM `notification_status`: `queued`, `sent`, `delivered`, `failed`, DEFAULT 'queued')
- `scheduled_for` (TIMESTAMPTZ, NOT NULL)
- `sent_at` (TIMESTAMPTZ)
- `error_log` (TEXT)
- `created_at` (TIMESTAMPTZ, DEFAULT now())

#### 19. `audit_logs` (Trilha de Auditoria de Ações Críticas)
- `id` (UUID, PK)
- `tenant_id` (UUID, FK -> `tenants.id` ON DELETE SET NULL)
- `actor_id` (UUID, FK -> `profiles.id` ON DELETE SET NULL)
- `actor_email` (VARCHAR(150))
- `action` (VARCHAR(100), NOT NULL) — Ex: `tenant.suspended`, `appointment.force_canceled`, `plan.updated`
- `entity_type` (VARCHAR(50), NOT NULL) — Ex: `tenants`, `appointments`, `subscriptions`
- `entity_id` (VARCHAR(100))
- `previous_state` (JSONB)
- `new_state` (JSONB)
- `ip_address` (VARCHAR(45))
- `user_agent` (TEXT)
- `created_at` (TIMESTAMPTZ, DEFAULT now())

#### 20. `webhook_events` (Idempotência de Webhooks Stripe e Externos)
- `id` (UUID, PK)
- `provider` (VARCHAR(50), NOT NULL) — Ex: `stripe`
- `event_id` (VARCHAR(150), NOT NULL, UNIQUE, INDEX)
- `event_type` (VARCHAR(100), NOT NULL)
- `payload` (JSONB, NOT NULL)
- `status` (ENUM `webhook_status`: `pending`, `processed`, `ignored`, `failed`, DEFAULT 'pending')
- `error_message` (TEXT)
- `processed_at` (TIMESTAMPTZ)
- `created_at` (TIMESTAMPTZ, DEFAULT now())

---

## 7. POLÍTICAS DE SEGURANÇA EM NÍVEL DE LINHA (RLS)

O RLS está ativado em **100% das tabelas** (`ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;`).

### Função Helper Fundamental de Segurança:
```sql
-- Identifica se a sessão pertence a um Super Admin da Plataforma
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'is_platform_admin')::boolean,
    false
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Retorna o tenant_id ativo do usuário autenticado
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID AS $$
  SELECT (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Retorna a role do usuário no tenant atual
CREATE OR REPLACE FUNCTION public.current_user_tenant_role()
RETURNS public.tenant_role AS $$
  SELECT (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role')::public.tenant_role;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

### Exemplos de Políticas RLS Concretas:

#### Tabela `tenants`:
- **SELECT:**
  - Usuários autenticados podem ler seu próprio tenant: `id = public.current_tenant_id()`.
  - Super Admins podem ler todos os tenants: `public.is_platform_admin() = true`.
  - **Público (Anônimo):** Leitura de campos públicos restritos (`id, slug, trade_name, logo_url, phone, address_*, primary_color, secondary_color, status`) via view pública ou política restrita a `status = 'active'`.
- **UPDATE:** Apenas `public.is_platform_admin() = true` ou (`id = public.current_tenant_id()` AND `public.current_user_tenant_role() = 'owner'`).

#### Tabela `appointments`:
- **SELECT:**
  - `public.is_platform_admin() = true` OU
  - `(tenant_id = public.current_tenant_id() AND public.current_user_tenant_role() IN ('owner', 'admin', 'receptionist'))` OU
  - `(tenant_id = public.current_tenant_id() AND public.current_user_tenant_role() = 'professional' AND professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid()))`.
- **INSERT / UPDATE:**
  - Membros autorizados do tenant (`owner`, `admin`, `receptionist`, e `professional` apenas para seus horários).
  - Clientes públicos **NÃO** realizam `INSERT` direto via REST na tabela `appointments`. Eles invocam a função RPC segura `public.book_public_appointment(...)` (Security Definer com validação estrita).

#### Tabela `financial_transactions`:
- **SELECT / INSERT / UPDATE / DELETE:**
  - `public.is_platform_admin() = true` OU
  - `(tenant_id = public.current_tenant_id() AND public.current_user_tenant_role() IN ('owner', 'admin'))`.
  - Barbeiros e recepcionistas têm leitura bloqueada por RLS das contas consolidadas.

---

## 8. MOTOR DE HORÁRIOS & CÁLCULO DE DISPONIBILIDADE

O cálculo de horários livres é processado no banco de dados através da função PostgreSQL `public.get_available_slots(...)` para eliminar concorrência, latência e divergências de relógio.

### Fórmula Rigorosa de Disponibilidade:
```text
Slot de Horário [S_start, S_end] está LIVRE para Profissional P na Data D se:
1. Data D pertence ao horário de funcionamento geral do Tenant (`business_hours`);
2. S_start >= business_hours.open_time E S_end <= business_hours.close_time;
3. [S_start, S_end] NÃO intersecta com intervalo de almoço do Tenant (`break_start`, `break_end`);
4. P está ativo na barbearia e escala de P (`professional_schedules`) existe para D;
5. P NÃO está em folga (`is_day_off = false`) para D;
6. S_start >= professional_schedules.start_time E S_end <= professional_schedules.end_time;
7. [S_start, S_end] NÃO intersecta com o intervalo pessoal de P;
8. NÃO existe nenhum registro em `schedule_blocks` cobrindo [S_start, S_end] para o tenant ou para P;
9. NÃO existe agendamento existente com status IN ('scheduled', 'confirmed', 'in_progress') para P onde:
   (appointment.start_time < S_end) AND (appointment.end_time > S_start);
10. S_start >= NOW() + INTERVAL '15 minutes' (tempo mínimo de antecedência).
```

### Constraint de Integridade Contra Double-Booking (Sobrecarga de Agendamento):
Para garantir atomicidade e impossibilitar fisicamente dois agendamentos simultâneos no mesmo barbeiro (mesmo que duas pessoas cliquem no milissegundo idêntico no chat):
```sql
-- Requer a extensão btree_gist
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.appointments
ADD CONSTRAINT prevent_barber_double_booking
EXCLUDE USING gist (
  tenant_id WITH =,
  professional_id WITH =,
  tstzrange(start_time, end_time) WITH &&
)
WHERE (status IN ('scheduled', 'confirmed', 'in_progress'));
```
> Com essa constraint nativa do Postgres, qualquer tentativa concorrente é rejeitada a nível de engine com transação isolada, retornando erro imediato e solicitando que o cliente escolha outro horário.

---

## 9. MÁQUINA DE ESTADOS DO AGENDAMENTO (APPOINTMENT)

```
                     ┌───────────────┐
                     │   SCHEDULED   │ <─── Criado via Chat Público ou Balcão
                     └───────┬───────┘
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
     │  CONFIRMED  │  │  CANCELED   │  │ RESCHEDULED │
     └──────┬──────┘  └─────────────┘  └─────────────┘
            │
            ├────────────────┐
            ▼                ▼
     ┌─────────────┐  ┌─────────────┐
     │ IN_PROGRESS │  │   NO_SHOW   │
     └──────┬──────┘  └─────────────┘
            │
            ▼
     ┌─────────────┐
     │  COMPLETED  │ ───> Dispara criação de transação financeira em `financial_transactions`
     └─────────────┘
```

### Transições e Regras de Validação:
- `SCHEDULED -> CONFIRMED`:
  - Acionado pelo cliente ao responder link/botão de confirmação, ou marcado pelo recepcionista.
- `SCHEDULED / CONFIRMED -> CANCELED`:
  - **Se acionado pelo cliente:** Permitido apenas se o tempo restante até `start_time` for superior ao configurado no tenant (ex: mínimo de 2 horas antes).
  - **Se acionado pela barbearia:** Permitido a qualquer momento com motivo obrigatório. Libera o slot imediatamente.
- `SCHEDULED / CONFIRMED -> RESCHEDULED`:
  - Gera atualização dos horários ou cancelamento do atual com vínculo ao novo `appointment_id`.
- `SCHEDULED / CONFIRMED -> NO_SHOW` (Não Compareceu):
  - Marcado após 15 a 30 minutos de atraso pelo profissional ou recepcionista. Incrementa histórico de faltas do cliente.
- `IN_PROGRESS -> COMPLETED`:
  - Ao finalizar o corte/barba. Aciona trigger que atualiza `customers.total_appointments`, `customers.total_spent_cents`, e gera o registro a receber no módulo financeiro.

---

## 10. MODELAGEM DE AGENDAMENTOS RECORRENTES

A recorrência no MetricBarber é estruturada através da entidade pai `appointment_series` e ocorrências filhas em `appointments`.

### Como Funciona:
1. **Definição da Série:** O barbeiro ou cliente seleciona: frequência (`weekly`, `biweekly`), dia da semana, horário fixo, data de início e quantidade de ocorrências (ex: 8 semanas seguidas).
2. **Geração de Ocorrências:**
   - Uma procedure valida a disponibilidade de todas as datas futuras solicitadas.
   - Os registros individuais são inseridos em `appointments` com `series_id` apontando para a série e `series_index` (1, 2, 3...).
3. **Cancelamento / Edição:**
   - **Cancelar apenas esta ocorrência:** Atualiza o status da ocorrência específica para `canceled`. A série permanece ativa.
   - **Cancelar toda a série:** Atualiza a `appointment_series.status = 'canceled'` e cancela em lote todos os agendamentos daquela série com `start_time > now()`.

---

## 11. CHAT DE AGENDAMENTO PÚBLICO (NÍVEL 3)

### Fluxo de Estados do Chat Conversacional (State Machine)

```
[ESTADO 0: INIT]
   │
   ├─ Carrega dados públicos da barbearia (Nome, Logo, Cores) via slug
   │
   ▼
[ESTADO 1: WELCOME]
   │
   ├─ Mensagem: "Olá! Seja bem-vindo à {Nome Fantasia}. Vamos agendar seu horário?"
   ├─ Opções: [ Ver Serviços & Agendar ] / [ Consultar Meus Agendamentos ]
   │
   ▼
[ESTADO 2: SELECT_SERVICE]
   │
   ├─ Apresenta cartões de serviços com Foto, Nome, Duração e Preço
   ├─ Permite selecionar 1 ou múltiplos serviços (soma de duração e valor)
   ├─ Botão: [ Voltar ]
   │
   ▼
[ESTADO 3: SELECT_PROFESSIONAL]
   │
   ├─ Opções: [ Qualquer Barbeiro Disponível ] OU Lista de Barbeiros habilitados
   ├─ Botão: [ Voltar ]
   │
   ▼
[ESTADO 4: SELECT_DATE]
   │
   ├─ Mini-calendário com os próximos 15 a 30 dias navegáveis
   ├─ Dias sem expediente ou lotados aparecem desabilitados
   ├─ Botão: [ Voltar ]
   │
   ▼
[ESTADO 5: SELECT_TIME]
   │
   ├─ Carrega slots livres da data selecionada via RPC `get_available_slots`
   ├─ Agrupados em: Manhã, Tarde, Noite
   ├─ Botão: [ Voltar ]
   │
   ▼
[ESTADO 6: IDENTIFICATION]
   │
   ├─ Solicita: "Qual seu nome?"
   ├─ Solicita: "Qual seu WhatsApp com DDD?" (Máscara automática)
   ├─ Se já existir cliente cadastrado com esse telefone no tenant:
   │    Reconhece o nome e exibe: "Bom te ver de novo, {Nome}!"
   │
   ▼
[ESTADO 7: REVIEW_AND_CONFIRM]
   │
   ├─ Resumo claro:
   │    💈 Serviço: Corte + Barba (45 min)
   │    ✂️ Barbeiro: João Silva
   │    📅 Data: Quinta-feira, 12 de Outubro
   │    ⏰ Horário: 14:30
   │    💵 Valor Total: R$ 65,00 (Pagamento no local)
   ├─ Ações: [ Confirmar Agendamento ] / [ Alterar Dados ]
   │
   ▼
[ESTADO 8: SUCCESS]
   │
   ├─ Transação executada com sucesso
   ├─ Mensagem de confirmação com link do agendamento
   ├─ Botões de ação rápida:
   │    - [ Adicionar ao Google Calendar / Apple Calendar ]
   │    - [ Abrir no WhatsApp ]
   │    - [ Cancelar ou Reagendar ]
```

### Retomada e Reconhecimento do Cliente:
- **Sem senha:** O cliente não precisa memorizar senhas.
- **Identificador de Sessão:** Uso de `localStorage` para guardar `client_phone` e token efêmero de agendamento.
- Ao entrar novamente no link, o sistema pergunta: *"Você é {Nome}? [ Sim ] [ Não, sou outro cliente ]"*.

---

## 12. GESTÃO DO LINK PÚBLICO E SLUGS

- Cada tenant define seu slug em Configurações (ex: `barbearia-vintage`).
- **Validação de Slug:**
  - Regex: `^[a-z0-9]+(?:-[a-z0-9]+)*$` (apenas letras minúsculas, números e hífens).
  - Comprimento: entre 3 e 50 caracteres.
  - Palavras reservadas bloqueadas: `admin`, `app`, `api`, `auth`, `dashboard`, `login`, `metricbarber`, `billing`, `support`, `settings`.
- **Comportamento em casos especiais:**
  - *Slug Inexistente:* Tela 404 amigável com busca de barbearias ou link para a home do MetricBarber.
  - *Barbearia Suspensa/Inadimplente:* Mensagem neutra: *"Esta barbearia está temporariamente indisponível para novos agendamentos online. Por favor, entre em contato diretamente pelo telefone."* (Sem expor status financeiro vexatório).

---

## 13. MÓDULO FINANCEIRO DA BARBEARIA (NÍVEL 2)

> **Importante:** Este módulo controla as finanças da **barbearia**, completamente independente da assinatura que a barbearia paga ao MetricBarber via Stripe.

### Funcionalidades:
1. **Contas a Receber (Receitas):**
   - Lançamento automático gerado quando um agendamento é marcado como `completed`.
   - Venda avulsa de produtos de balcão (pomadas, cervejas, lâminas).
2. **Contas a Pagar (Despesas):**
   - Despesas operacionais fixas e variáveis: Aluguel, Água/Luz, Produtos de higiene, Marketing.
3. **Divisão de Comissões de Barbeiros:**
   - Cálculo automático baseado na `commission_rate` cadastrada no profissional ou customizada no serviço.
   - Painel de Fechamento de Comissões quinzenal ou mensal com geração de comprovante de repasse.
4. **Resumo Financeiro:**
   - Faturamento Bruto vs. Líquido (após comissões).
   - Ticket Médio por cliente e por serviço.
   - Distribuição por método de pagamento (PIX, Cartão de Crédito, Dinheiro).

---

## 14. MÓDULO DE ESTOQUE (PRODUTOS & INSUMOS)

- **Cadastro de Produtos:** Nome, categoria, código de barras/SKU, preço de custo, preço de venda e quantidade mínima.
- **Tipos de Movimentação:**
  - `Entrada por Compra`: Reposição de mercadorias.
  - `Saída por Venda`: Venda direta no balcão associada ou não a um cliente.
  - `Uso Interno`: Shampoo e lâminas utilizados na bancada.
  - `Ajuste / Quebra`: Perdas, avarias ou acerto de inventário.
- **Alertas Automáticos:** Notificação visual no Dashboard quando `current_stock <= min_stock_alert`.

---

## 15. GESTÃO DO SAAS (NÍVEL 1), PLANOS & INTEGRAÇÃO STRIPE

### Estrutura Comercial do MetricBarber:
- **Trial Gratuito:** Todo tenant cadastrado inicia com 14 dias de Trial sem necessidade de cartão de crédito.
- **Catálogo de Planos:**
  - *Plano Solo:* 1 profissional, agendamentos ilimitados, chat público, financeiro básico.
  - *Plano Barbearia:* Até 5 profissionais, controle de estoque, comissões e relatórios avançados.
  - *Plano Rede / Enterprise:* Mais de 5 profissionais, suporte prioritário, múltiplas unidades (futuro).

### Fluxo Stripe Billing:
1. O proprietário clica em "Assinar Plano" dentro da barbearia.
2. Uma Edge Function `stripe-create-checkout-session` gera uma sessão do Stripe Checkout vinculada ao `tenant_id`.
3. O cliente preenche os dados de pagamento em ambiente seguro Stripe.
4. O Stripe envia webhook assinado para o endpoint `stripe-webhook` do MetricBarber.
5. A Edge Function processa o evento de forma **idempotente** gravando em `webhook_events` e atualiza a tabela `subscriptions` e `tenants`.

### Eventos Stripe Tratados:
- `checkout.session.completed`: Cria ou ativa a assinatura.
- `customer.subscription.updated`: Atualiza o período vigente, status (`active`, `past_due`) ou troca de plano.
- `customer.subscription.deleted`: Transiciona o tenant para status `canceled`.
- `invoice.payment_succeeded`: Confirma a renovação e prorroga `current_period_end`.
- `invoice.payment_failed`: Marca a assinatura como `past_due` e alerta a barbearia.

---

## 16. MÁQUINA DE ESTADOS DO CICLO DE VIDA DA BARBEARIA (TENANT)

```
                       ┌─────────────────────────┐
                       │          TRIAL          │ ─── (Duração: 14 dias)
                       └────────────┬────────────┘
                                    │
               ┌────────────────────┴────────────────────┐
               │ Assina plano (Stripe)                   │ Expira sem assinar
               ▼                                         ▼
     ┌───────────────────┐                     ┌───────────────────┐
     │      ACTIVE       │                     │     SUSPENDED     │ <─── Bloqueia agendamentos públicos
     └─────────┬─────────┘                     └─────────┬─────────┘
               │                                         │
               ├──────────────────────┐                  │ Não regulariza após 60 dias
               │ Falha de pagamento   │ Regulariza       ▼
               ▼                      │        ┌───────────────────┐
     ┌───────────────────┐            │        │     CANCELED      │ <─── Dados preservados por 1 ano
     │     PAST_DUE      │ ───────────┘        └───────────────────┘
     └─────────┬─────────┘
               │ Não regulariza após 7 dias de tolerância
               ▼
     ┌───────────────────┐
     │     SUSPENDED     │
     └───────────────────┘
```

### Comportamento em Cada Estado:
- **TRIAL:** Acesso a 100% dos recursos do plano contratado. Aviso no topo da tela com dias restantes.
- **ACTIVE:** Operação normal e irrestrita.
- **PAST_DUE:** Período de tolerância (grace period de 7 dias). O sistema continua funcionando, mas exibe aviso persistente para atualização do cartão de crédito.
- **SUSPENDED:**
  - O link público do chat é desativado para clientes.
  - O painel interno do tenant fica em modo *Somente Leitura*.
  - Exibe tela de regularização imediata com botão para o Stripe Customer Portal.
- **CANCELED:** Acesso desativado. Dados permanecem congelados para fins fiscais e de auditoria conforme a LGPD antes de descarte seguro.

---

## 17. ARQUITETURA DE NOTIFICAÇÕES, LEMBRETES & WHATSAPP

### Estrutura de Notificações Interna:
- Todo evento de agendamento (`created`, `canceled`, `rescheduled`) insere um registro na tabela `notification_logs`.
- Uma rotina agendada (Supabase `pg_cron` executando a cada 10 minutos) busca lembretes programados (`scheduled_for <= now() AND status = 'queued'`) e despacha para o provedor de mensageria.

### Regras de Negócio do WhatsApp:
- **Lembrete de Agendamento:** Disparado com antecedência configurada pela barbearia (ex: 2 horas antes do horário).
- Contém texto humanizado e botões/links para:
  - *Confirmar presença*
  - *Reagendar / Cancelar*

---

## 18. AUDITORIA E LOGS (COMPLIANCE)

- Tabela `audit_logs` registra alterações em tabelas sensíveis via triggers do PostgreSQL ou interceptores de Edge Functions.
- **Ações Auditadas:**
  - Login administrativo na plataforma MetricBarber.
  - Mudança manual de plano, status ou extensão de trial de qualquer barbearia.
  - Exclusão ou alteração de registros financeiros por usuários da barbearia.
  - Cancelamentos de agendamentos em massa.
- **Tempo de Retenção:** 1 ano para auditoria interna, com rotação automática via job.

---

## 19. INVENTÁRIO COMPLETO DE TELAS E ROTAS

### A. Plataforma MetricBarber (Nível 1 - Admin do SaaS)
1. `/admin/login` — Autenticação dos administradores globais.
2. `/admin/dashboard` — Métricas globais (Total de Barbearias, Ativas, Em Trial, MRR, Churn).
3. `/admin/tenants` — Listagem com filtros por status, plano e busca por nome/CNPJ.
4. `/admin/tenants/:id` — Visão 360º do tenant (dados cadastrais, usuários vinculados, histórico de pagamentos, ações de suporte).
5. `/admin/plans` — Gestão de planos, limites de barbeiros e preços integrados ao Stripe.
6. `/admin/subscriptions` — Visão detalhada de assinaturas ativas, atrasadas e canceladas.
7. `/admin/audit` — Visualização da trilha de auditoria e segurança.

### B. Backoffice da Barbearia (Nível 2 - Tenant)
1. `/auth/login` — Entrada do proprietário e colaboradores.
2. `/auth/register` — Onboarding de novas barbearias (início do trial).
3. `/auth/forgot-password` e `/auth/reset-password` — Recuperação segura de senha.
4. `/dashboard` — Painel do dia (próximos clientes, ocupação das cadeiras, faturamento estimado do dia, avisos de estoque).
5. `/agenda` — **Coração Operacional:** Visão diária por profissional e semanal. Filtros rápidos, modal de novo agendamento, bloqueio e edição rápida.
6. `/clientes` — Listagem de clientes, histórico de serviços, total gasto e botão rápido para WhatsApp.
7. `/servicos` — Cadastro e edição de serviços, preços, duração e profissionais vinculados.
8. `/profissionais` — Cadastro de barbeiros, escalas de dias e horários, intervalos e comissões.
9. `/financeiro` — Livro caixa (entradas e saídas), fechamento de comissões e filtros por período.
10. `/estoque` — Controle de produtos de revenda e bancada, reposição e alertas de estoque baixo.
11. `/relatorios` — Gráficos de faturamento, serviços mais demandados, desempenho por barbeiro e clientes sumidos.
12. `/configuracoes` — Dados da empresa, slug público, horário de funcionamento, logotipos e preferências do chat.
13. `/configuracoes/assinatura` — Gerenciamento do plano da barbearia, faturas Stripe e botão para o Stripe Customer Portal.

### C. Interface Pública de Agendamento (Nível 3 - Cliente)
1. `/:slug` — Chat conversacional interativo para agendamento.
2. `/:slug/agendamento/:id` — Página pública de confirmação, cancelamento ou reagendamento do agendamento com base em token seguro.

---

## 20. MAPEAMENTO DOS 22 FLUXOS CRÍTICOS (A a V)

Abaixo, a especificação detalhada de cada fluxo operacional exigido:

### Fluxo A: Administrador cria uma nova barbearia manualmente
- **Ator:** Super Admin (Plataforma).
- **Ação:** Preenche formulário em `/admin/tenants/new` com dados da barbearia e do proprietário.
- **Sistema:** Valida unicidade de slug e e-mail; inicia transação atômica.
- **Banco:** Insere em `tenants` (status: `active`), cria usuário em `profiles` e vincula como `owner` em `tenant_users`.
- **Validação:** RLS verifica se o ator possui role `super_admin`.
- **Resultado:** Barbearia criada, e-mail de boas-vindas disparado com convite para definir senha.

### Fluxo B: Barbearia inicia Trial (Self-Service)
- **Ator:** Proprietário da barbearia.
- **Ação:** Acessa landing page, clica em "Começar Grátis", insere Nome da Barbearia, WhatsApp, E-mail e Senha.
- **Sistema:** Supabase Auth cria a conta; trigger cria o `tenant` com slug sanitizado e `trial_ends_at = now() + interval '14 days'`.
- **Banco:** Registro inserido com status `trial`.
- **Resultado:** Usuário é redirecionado para o wizard de configuração inicial da barbearia (`/onboarding`).

### Fluxo C: Proprietário acessa a conta
- **Ator:** Proprietário.
- **Ação:** Insere e-mail e senha em `/auth/login`.
- **Sistema:** Supabase Auth valida credenciais e injeta claims (`tenant_id`, `role: owner`) no JWT.
- **Banco:** Registra timestamp de último login.
- **Resultado:** Redirecionado para `/dashboard` com RLS restrito ao seu `tenant_id`.

### Fluxo D: Proprietário configura a barbearia
- **Ator:** Proprietário.
- **Ação:** Altera logotipo, cores primárias, endereço e configurações de cancelamento em `/configuracoes`.
- **Sistema:** Upload do logo para o bucket público `tenants-media` no Supabase Storage; payload enviado ao Supabase.
- **Banco:** `UPDATE public.tenants SET ... WHERE id = current_tenant_id()`.
- **Resultado:** Interface do chat público e da barbearia passam a exibir a nova identidade visual.

### Fluxo E: Proprietário cadastra profissional
- **Ator:** Proprietário ou Gerente.
- **Ação:** Preenche nome, telefone, comissão (ex: 50%) e cor da agenda em `/profissionais`.
- **Sistema:** Valida limites do plano contratado (ex: impede cadastrar o 6º barbeiro se o plano permite 5).
- **Banco:** `INSERT INTO public.professionals (tenant_id, name, commission_rate, ...)`.
- **Resultado:** Novo profissional aparece imediatamente nas colunas da agenda e na lista do chat público.

### Fluxo F: Proprietário cadastra serviço
- **Ator:** Proprietário ou Gerente.
- **Ação:** Cadastra "Corte + Barba", R$ 70,00, 45 minutos em `/servicos` e marca quais barbeiros fazem o serviço.
- **Sistema:** Validações de campos obrigatórios e inteiros positivos.
- **Banco:** Insere em `services` e nos vínculos correspondentes em `professional_services`.
- **Resultado:** Serviço disponível para agendamentos internos e no chat do cliente.

### Fluxo G: Proprietário configura horários
- **Ator:** Proprietário.
- **Ação:** Define expediente de Segunda a Sábado das 09:00 às 20:00 com intervalo das 12:00 às 13:00 em `/configuracoes`.
- **Sistema:** Envia matriz de horários semanais.
- **Banco:** `UPSERT` em `business_hours` por `day_of_week`.
- **Resultado:** Motor de disponibilidade passa a restringir slots fora dessa janela.

### Fluxo H: Cliente acessa link público
- **Ator:** Cliente final.
- **Ação:** Abre no navegador do celular `https://metricbarber.com.br/barbearia-vintage`.
- **Sistema:** Busca dados públicos do tenant via slug.
- **Banco:** `SELECT trade_name, logo_url, primary_color, status FROM tenants WHERE slug = 'barbearia-vintage'`.
- **Resultado:** Tela de boas-vindas do chat é renderizada com a identidade visual da barbearia.

### Fluxo I: Cliente realiza agendamento pelo chat
- **Ator:** Cliente final.
- **Ação:** Escolhe serviço, profissional, data, horário, digita Nome e Celular e clica em "Confirmar".
- **Sistema:** Invoca RPC segura `book_public_appointment(...)`.
- **Banco:**
  1. Cria ou recupera registro em `customers` pelo número de telefone;
  2. Verifica constraint de não-conflito;
  3. Insere em `appointments` com status `scheduled`;
  4. Insere registro em `notification_logs`.
- **Resultado:** Chat exibe confirmação imediata com botões de adicionar ao calendário.

### Fluxo J: Agendamento aparece imediatamente na agenda
- **Ator:** Sistema em tempo real.
- **Ação:** Disparo de evento `INSERT` na tabela `appointments`.
- **Sistema:** Supabase Realtime propaga evento via WebSocket para o canal do tenant `tenant:{tenant_id}:appointments`.
- **Banco:** Transação concluída com sucesso.
- **Resultado:** A agenda do barbeiro e do recepcionista é atualizada na tela sem necessidade de dar F5 / refresh.

### Fluxo K: Profissional visualiza o agendamento
- **Ator:** Barbeiro logado no sistema.
- **Ação:** Clica sobre o bloco do agendamento em sua agenda pessoal.
- **Sistema:** Consulta detalhes do cliente e observações de cortes anteriores.
- **Banco:** RLS garante que o profissional só acesse o agendamento se for o responsável por ele.
- **Resultado:** Modal abre com dados do cliente, horário e serviços solicitados.

### Fluxo L: Cliente cancela agendamento
- **Ator:** Cliente final.
- **Ação:** Acessa link único recebido via WhatsApp/Chat e clica em "Cancelar Agendamento".
- **Sistema:** Verifica política de cancelamento (ex: antecedência mínima de 2 horas).
- **Banco:** `UPDATE appointments SET status = 'canceled', canceled_by = 'client' WHERE id = :id`.
- **Resultado:** Horário é liberado instantaneamente na agenda para outros clientes; profissional recebe notificação.

### Fluxo M: Cliente reagenda
- **Ator:** Cliente final.
- **Ação:** Acessa link do agendamento, escolhe nova data/horário disponível e confirma.
- **Sistema:** RPC segura cancela o horário anterior e reserva atomicamente o novo.
- **Banco:** Atualiza horários ou cria novo registro vinculado com `status = 'rescheduled'`.
- **Resultado:** Agenda reorganizada em tempo real; slots atualizados.

### Fluxo N: Agendamento recorrente é criado
- **Ator:** Recepcionista ou Proprietário.
- **Ação:** Cria agendamento marcando "Repetir semanalmente por 8 semanas".
- **Sistema:** Valida disponibilidade de cada uma das 8 semanas.
- **Banco:** Cria registro em `appointment_series` e insere os 8 registros correspondentes em `appointments` vinculados à série.
- **Resultado:** Todas as 8 semanas ficam bloqueadas na agenda com o ícone de recorrência.

### Fluxo O: Lembrete é enviado
- **Ator:** Job automático do sistema (`pg_cron` / Edge Function).
- **Ação:** Varre `notification_logs` a cada 10 minutos.
- **Sistema:** Localiza agendamentos marcados para daqui a 2 horas com status `queued`.
- **Banco:** Atualiza status para `sent` e registra `sent_at = now()`.
- **Resultado:** Mensagem de lembrete com botões interativos chega ao WhatsApp do cliente.

### Fluxo P: Assinatura Stripe é criada
- **Ator:** Proprietário da barbearia.
- **Ação:** Seleciona o plano Pro e insere os dados do cartão de crédito no Stripe Checkout.
- **Sistema:** Stripe processa cobrança e emite webhook `checkout.session.completed`.
- **Banco:** Edge Function recebe webhook assinado, valida idempotência e atualiza `subscriptions` e `tenants.status = 'active'`.
- **Resultado:** Limites do novo plano são desbloqueados na conta da barbearia.

### Fluxo Q: Pagamento de assinatura é aprovado (Renovação)
- **Ator:** Stripe Billing (Evento recorrente).
- **Ação:** Cobra com sucesso a mensalidade no cartão cadastrado.
- **Sistema:** Webhook `invoice.payment_succeeded` é enviado ao MetricBarber.
- **Banco:** Atualiza `current_period_end` para +30 dias e mantém `status = 'active'`.
- **Resultado:** Acesso mantido sem qualquer interrupção.

### Fluxo R: Pagamento de assinatura falha
- **Ator:** Stripe Billing.
- **Ação:** Tentativa de cobrança recusada pelo banco do cliente.
- **Sistema:** Recebe webhook `invoice.payment_failed`.
- **Banco:** Atualiza `subscriptions.status = 'past_due'` e `tenants.status = 'past_due'`.
- **Resultado:** Banner de alerta surge no topo do painel da barbearia informando que há 7 dias para regularizar o cartão antes da suspensão.

### Fluxo S: Assinatura é cancelada
- **Ator:** Proprietário ou Stripe (por falta de pagamento persistente).
- **Ação:** Proprietário cancela assinatura ou webhook `customer.subscription.deleted` é recebido.
- **Sistema:** Atualiza status do tenant para `suspended` ou `canceled`.
- **Banco:** Atualiza `tenants.status = 'canceled'`.
- **Resultado:** Acesso da equipe ao painel é restrito e link público é desativado.

### Fluxo T: Tenant é suspenso
- **Ator:** Super Admin ou Rotina Automática de Inadimplência.
- **Ação:** Suspende o tenant por inadimplência após 7 dias de tolerância.
- **Sistema:** Bloqueia operações de escrita e desativa link do chat.
- **Banco:** `UPDATE tenants SET status = 'suspended'`.
- **Resultado:** Tela de bloqueio suave exibida com botão de regularização.

### Fluxo U: Tenant é reativado
- **Ator:** Proprietário (via pagamento no Stripe Customer Portal) ou Super Admin.
- **Ação:** Pagamento é efetuado com sucesso.
- **Sistema:** Webhook Stripe processa quitação ou Super Admin clica em "Reativar".
- **Banco:** `UPDATE tenants SET status = 'active'`.
- **Resultado:** Operação e link público restaurados instantaneamente.

### Fluxo V: Administrador da plataforma acessa informações do tenant
- **Ator:** Super Admin ou Suporte.
- **Ação:** Acessa `/admin/tenants/:id` para prestar atendimento ou verificar logs de erro.
- **Sistema:** Valida claim `is_platform_admin = true`.
- **Banco:** Permite leitura supervisionada dos dados operacionais e insere registro na tabela `audit_logs`.
- **Resultado:** Suporte visualiza os dados necessários sem expor senhas ou tokens privados.

---

## 21. REGRAS DE NEGÓCIO INEGOCIÁVEIS

1. **Isolamento de Dados:** Um tenant jamais pode acessar, modificar, contar ou deduzir informações de outro tenant.
2. **Atomicidade da Agenda:** Nunca pode haver dois agendamentos simultâneos no mesmo horário para o mesmo barbeiro (garantido pela constraint Postgres `prevent_barber_double_booking`).
3. **Cálculo Server-Side:** O cálculo de horários livres, durações de atendimento e comissões deve ser executado obrigatoriamente no banco ou em Edge Functions. O frontend apenas exibe os slots retornados.
4. **Respeito aos Limites do Plano:** O sistema deve impedir ativamente a criação de mais barbeiros do que o limite permitido pelo plano ativo na tabela `plans`.
5. **Autonomia do Cliente Final:** O cliente não precisa criar conta com senha para agendar, cancelar ou reagendar (autenticação por link com hash assinado ou verificação de telefone).
6. **Integridade Financeira:** Nenhum agendamento concluído pode ter seu registro financeiro alterado sem registrar log de auditoria.

---

## 22. CRITÉRIOS DE ACEITE E DEFINIÇÃO DE PRONTO (DoD) POR MÓDULO

- **Autenticação & Tenant Context:** Concluído quando um usuário logado carrega seus dados restritos pelo RLS e a troca de conta/sessão não deixa resíduos de cache.
- **Agenda:** Concluída quando reflete agendamentos reais em tempo real, permite arrastar ou editar status, impede sobreposições e respeita folgas/intervalos.
- **Chat de Agendamento:** Concluído quando um cliente anônimo em celular consegue realizar um agendamento do início ao fim em menos de 1 minuto, gravando cliente e horário reais no banco.
- **Stripe:** Concluído quando um checkout real em modo de testes transiciona o tenant de `trial` para `active` via webhook autenticado e idempotente.

---

## 23. ROADMAP DE IMPLEMENTAÇÃO EM FASES EXECUTÁVEIS

Este roadmap foi ordenado respeitando rigorosamente as dependências técnicas:

```
FASE 1: Fundação do Repositório, Tooling e Arquitetura Base
FASE 2: Schema Supabase, Tipos TypeScript, Enums e RLS
FASE 3: Supabase Auth, Profiles, Tenant Context e Custom Claims Hook
FASE 4: Onboarding de Barbearias e Gestão de Tenants
FASE 5: Configuração de Horários, Intervalos e Escalas
FASE 6: Cadastro de Profissionais, Serviços e Vínculos
FASE 7: Motor de Disponibilidade (RPC get_available_slots)
FASE 8: Core da Agenda (Views Diária e Semanal, Realtime)
FASE 9: Cadastro e Gestão de Clientes (Deduplicação por WhatsApp)
FASE 10: Agendamento Interno e Modal de Atendimento
FASE 11: Chat Público de Agendamento (Mobile Conversational UI)
FASE 12: Motor de Séries e Agendamentos Recorrentes
FASE 13: Notificações, Lembretes e Fila de Mensagens
FASE 14: Módulo Financeiro (Caixa, Comissões e Despesas)
FASE 15: Módulo de Estoque (Produtos e Movimentações)
FASE 16: Painel Administrativo do SaaS (Nível 1)
FASE 17: Integração Stripe (Checkout, Customer Portal e Webhooks)
FASE 18: Auditoria, Hardening de Segurança, Testes E2E e Lançamento
```

---

## 24. MATRIZ DE RISCOS TÉCNICOS E MITIGAÇÃO

| Risco Técnico | Impacto | Mitigação Arquitetural |
| :--- | :--- | :--- |
| **Race condition em agendamentos simultâneos** | Alto (dois clientes agendados no mesmo horário) | Constraint `EXCLUDE USING gist` com ranges de tempo a nível de engine Postgres |
| **Bypass acidental de RLS** | Crítico (vazamento de dados entre barbearias) | Testes automatizados de RLS; política de deny padrão e verificação de claims de JWT |
| **Perda ou reprocessamento de Webhooks Stripe** | Alto (falha na ativação de planos) | Tabela `webhook_events` com verificação de idempotência por `event_id` único |
| **Spam / Ataque de reservas falsas no Chat Público** | Médio (bloqueio indevido de horários de barbeiros) | Rate limiting por IP/telefone na RPC, validação de número de telefone e bloqueio de clientes |

---

## 25. ITENS MARCADOS COMO: "DECISÃO NECESSÁRIA"

Conforme a diretriz de não inventar comportamentos fora do escopo ou da referência do InBarber, os pontos abaixo requerem direcionamento do proprietário do produto antes de suas fases de implementação:

1. **[DECISÃO NECESSÁRIA — MENSAGERIA / WHATSAPP]**  
   *Contexto:* O sistema de lembretes e confirmações precisa enviar mensagens para o cliente final.  
   *Opções de Decisão:*  
   - **Opção A:** Integração com a API Oficial da Meta (Cloud API - WhatsApp Business). Requer aprovação de templates, empresa verificada no Facebook e cobrança por conversa da Meta.  
   - **Opção B:** Provedor de API não-oficial de gateway WhatsApp (ex: Evolution API, Z-API, Z-Stack). Mais simples e flexível, sem custos por mensagem da Meta, porém sujeito a riscos de bloqueio de chip.  
   - **Opção C:** Modo Manual / Sem Custo (Fase inicial): O sistema apenas gera o link `https://wa.me/55...` com texto pronto e o barbeiro/recepcionista clica para abrir e enviar pelo seu próprio WhatsApp web/app.

2. **[DECISÃO NECESSÁRIA — MODELO DE PAGAMENTO NO CHAT PÚBLICO]**  
   *Contexto:* O InBarber foca em agendamento com pagamento presencial no balcão da barbearia.  
   *Opções de Decisão:*  
   - **Opção A (Padrão InBarber):** 100% dos pagamentos ocorrem na barbearia (Dinheiro, PIX ou Maquininha local). O chat é estritamente para agendamento.  
   - **Opção B:** Habilitar cobrança de sinal/reserva online (via PIX dinâmico ou Cartão de Crédito) para evitar faltas (no-show). Requer integração de split de pagamento (Stripe Connect ou Asaas/MercadoPago).

3. **[DECISÃO NECESSÁRIA — DOMÍNIOS PERSONALIZADOS]**  
   *Contexto:* O acesso ao chat será padronizado como `metricbarber.com.br/:slug`.  
   *Opções de Decisão:*  
   - **Opção A:** Apenas subcaminho `metricbarber.com.br/nome-da-barbearia` (suficiente, rápido e sem custos adicionais de DNS).  
   - **Opção B:** Permitir no futuro domínio próprio da barbearia (ex: `agendamento.barbeariavintage.com.br`) via CNAME e proxy reverso.
