create table if not exists rentabilidade_item_configs (
  id bigserial primary key,
  account_key text not null,
  seller_id bigint null,
  item_id text not null,
  custo_produto_unitario numeric(14,2) not null default 0,
  aliquota numeric(8,4) not null default 0,
  updated_by bigint null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rentabilidade_item_configs_uq unique (account_key, item_id)
);

create index if not exists idx_rentab_item_cfg_account on rentabilidade_item_configs(account_key);
create index if not exists idx_rentab_item_cfg_item on rentabilidade_item_configs(item_id);

create table if not exists rentabilidade_item_config_history (
  id bigserial primary key,
  config_id bigint null references rentabilidade_item_configs(id) on delete set null,
  account_key text not null,
  seller_id bigint null,
  item_id text not null,
  custo_produto_unitario numeric(14,2) not null default 0,
  aliquota numeric(8,4) not null default 0,
  source text not null default 'manual',
  changed_by bigint null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_rentab_item_cfg_hist_account_item on rentabilidade_item_config_history(account_key, item_id);
