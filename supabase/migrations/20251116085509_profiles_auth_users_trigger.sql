-- Create or replace a function that auto-creates a public.profiles row
-- whenever a new auth.users row is inserted.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Avoid inserting if a profile already exists for this user (idempotent).
  if exists (select 1 from public.profiles where id = new.id) then
    return new;
  end if;

  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce((new.raw_user_meta_data->>'full_name'), (new.raw_user_meta_data->>'name')),
    new.raw_user_meta_data->>'avatar_url'
  );

  return new;
end;
$$;

-- Drop existing trigger if present so migration is idempotent.
drop trigger if exists on_auth_user_created_profiles on auth.users;

-- Create the trigger on auth.users to call the function after insert.
create trigger on_auth_user_created_profiles
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

