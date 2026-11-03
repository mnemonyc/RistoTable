-- Chiusure giornaliere del ristorante BACCO IL TEMPIO DEL PANZEROTTO
-- Eseguire una sola volta nel Supabase SQL Editor.

create table if not exists public.business_closures (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  closed_date date not null,
  created_at timestamptz not null default now(),
  constraint business_closures_restaurant_date_unique unique (restaurant_id, closed_date)
);

create index if not exists business_closures_restaurant_date_idx
  on public.business_closures (restaurant_id, closed_date);

alter table public.business_closures enable row level security;

drop policy if exists "Authenticated users can read business closures" on public.business_closures;
create policy "Authenticated users can read business closures"
  on public.business_closures
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert business closures" on public.business_closures;
create policy "Authenticated users can insert business closures"
  on public.business_closures
  for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update business closures" on public.business_closures;
create policy "Authenticated users can update business closures"
  on public.business_closures
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete business closures" on public.business_closures;
create policy "Authenticated users can delete business closures"
  on public.business_closures
  for delete
  to authenticated
  using (true);

grant select, insert, update, delete on public.business_closures to authenticated;
