create table public.telegram_chats (
  chat_id text primary key,
  title text,
  added_at timestamptz not null default now()
);

grant all on public.telegram_chats to service_role;
grant select on public.telegram_chats to authenticated;

alter table public.telegram_chats enable row level security;

create policy "admins can view telegram chats"
on public.telegram_chats
for select
to authenticated
using (public.is_admin(auth.uid()));