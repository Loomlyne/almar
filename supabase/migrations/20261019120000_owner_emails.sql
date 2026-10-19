-- Owner, 2026-10-19: the dashboard signs in koussayzayeni@gmail.com as well as maria@almarprivatejourney.com.
-- The same list is OWNER_EMAILS in lib/auth/rules.ts; change both together. As in the platform spine, the owner
-- role is given only here, to a confirmed email, and the owner account itself is made in the Supabase dashboard,
-- never by a sign-in link (D-42).

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is not null and new.email_confirmed_at is not null then
    insert into public.profiles (id, email, role)
    values (
      new.id,
      lower(new.email),
      case when lower(new.email) in ('maria@almarprivatejourney.com', 'koussayzayeni@gmail.com') then 'owner' else 'guest' end
    )
    on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;

-- A profile that already exists for a listed address (for example one made by a public sign-in) becomes the owner.
update public.profiles p
set role = 'owner'
from auth.users u
where u.id = p.id
  and u.email_confirmed_at is not null
  and lower(u.email) in ('maria@almarprivatejourney.com', 'koussayzayeni@gmail.com')
  and p.role <> 'owner';
