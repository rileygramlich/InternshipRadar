-- Creates a profile row whenever a new auth user is created.
-- Run this in Supabase SQL Editor.

-- Ensure profiles uses auth uid as primary key
-- (table already exists with UUID PK; this will insert using auth user id)

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, discord_webhook_url, skills, location_preference)
  values (new.id, null, array[]::text[], null)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
