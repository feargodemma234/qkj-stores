create extension if not exists "pgcrypto";

create type public.user_role as enum (
  'buyer',
  'seller',
  'admin'
);

create type public.listing_status as enum (
  'draft',
  'pending',
  'approved',
  'rejected',
  'sold',
  'unpublished'
);

create type public.order_status as enum (
  'pending',
  'funded',
  'in_review',
  'released',
  'refunded',
  'cancelled'
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id)
    on delete cascade,

  display_name text,
  email text,

  role public.user_role default 'buyer',

  verified boolean default false,

  bio text,
  website text,

  created_at timestamptz default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),

  seller_id uuid not null
    references public.profiles(id)
    on delete cascade,

  title text not null,
  domain text,

  description text,

  category_id uuid
    references public.categories(id),

  price numeric(14,2) not null default 0,

  currency text default 'USD',

  traffic_monthly bigint default 0,

  revenue_monthly numeric(14,2) default 0,

  profit_monthly numeric(14,2) default 0,

  image_url text,

  screenshots text[] default '{}',

  status public.listing_status default 'pending',

  featured boolean default false,

  created_at timestamptz default now(),

  updated_at timestamptz default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),

  listing_id uuid
    references public.listings(id)
    on delete cascade,

  sender_id uuid
    references public.profiles(id)
    on delete cascade,

  recipient_id uuid
    references public.profiles(id)
    on delete cascade,

  body text not null,

  read_at timestamptz,

  created_at timestamptz default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),

  listing_id uuid
    references public.listings(id)
    on delete cascade,

  reporter_id uuid
    references public.profiles(id)
    on delete cascade,

  reason text not null,

  details text,

  status text default 'open',

  created_at timestamptz default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),

  listing_id uuid
    references public.listings(id),

  buyer_id uuid
    references public.profiles(id),

  seller_id uuid
    references public.profiles(id),

  amount numeric(14,2) not null,

  currency text default 'USD',

  status public.order_status default 'pending',

  payment_reference text,

  created_at timestamptz default now(),

  updated_at timestamptz default now()
);

create table if not exists public.site_settings (
  key text primary key,

  value jsonb not null
    default '{}'::jsonb
);

insert into public.categories(name)
values
  ('SaaS'),
  ('E-commerce'),
  ('Content'),
  ('Blog'),
  ('Agency'),
  ('Tools'),
  ('Mobile App'),
  ('Other')
on conflict do nothing;

insert into public.site_settings(key, value)
values
(
  'listing_fee',
  '{"enabled":false,"amount":0,"currency":"USD"}'
),
(
  'featured_fee',
  '{"enabled":true,"amount":20,"currency":"USD"}'
),
(
  'commission',
  '{"enabled":false,"percent":0}'
),
(
  'seller_subscription',
  '{"enabled":false,"monthly":0,"currency":"USD"}'
)
on conflict do nothing;

alter table public.profiles enable row level security;

alter table public.categories enable row level security;

alter table public.listings enable row level security;

alter table public.messages enable row level security;

alter table public.reports enable row level security;

alter table public.orders enable row level security;

alter table public.site_settings enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.profiles
    where id = auth.uid()
    and role = 'admin'
  );
$$;

create policy "profiles public read"
on public.profiles
for select
using (true);

create policy "profiles own insert"
on public.profiles
for insert
with check (id = auth.uid());

create policy "profiles own update"
on public.profiles
for update
using (
  id = auth.uid()
  or public.is_admin()
);

create policy "categories public read"
on public.categories
for select
using (true);

create policy "categories admin write"
on public.categories
for all
using (public.is_admin())
with check (public.is_admin());

create policy "approved listings public read"
on public.listings
for select
using (
  status = 'approved'
  or seller_id = auth.uid()
  or public.is_admin()
);

create policy "seller listings insert"
on public.listings
for insert
with check (
  seller_id = auth.uid()
);

create policy "seller listings update"
on public.listings
for update
using (
  seller_id = auth.uid()
  or public.is_admin()
)
with check (
  seller_id = auth.uid()
  or public.is_admin()
);

create policy "admin listings delete"
on public.listings
for delete
using (public.is_admin());

create policy "participants read messages"
on public.messages
for select
using (
  sender_id = auth.uid()
  or recipient_id = auth.uid()
  or public.is_admin()
);

create policy "send messages"
on public.messages
for insert
with check (
  sender_id = auth.uid()
);

create policy "participants update messages"
on public.messages
for update
using (
  sender_id = auth.uid()
  or recipient_id = auth.uid()
  or public.is_admin()
);

create policy "reports insert"
on public.reports
for insert
with check (
  reporter_id = auth.uid()
);

create policy "reports read"
on public.reports
for select
using (
  reporter_id = auth.uid()
  or public.is_admin()
);

create policy "reports admin update"
on public.reports
for update
using (public.is_admin())
with check (public.is_admin());

create policy "orders participants read"
on public.orders
for select
using (
  buyer_id = auth.uid()
  or seller_id = auth.uid()
  or public.is_admin()
);

create policy "orders buyer insert"
on public.orders
for insert
with check (
  buyer_id = auth.uid()
);

create policy "orders admin update"
on public.orders
for update
using (public.is_admin())
with check (public.is_admin());

create policy "settings public read"
on public.site_settings
for select
using (true);

create policy "settings admin write"
on public.site_settings
for all
using (public.is_admin())
with check (public.is_admin());