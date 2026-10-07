-- Stage 7 security hardening. Review/apply in Supabase SQL Editor.
revoke execute on function public.create_party_public_link(text) from anon;
revoke execute on function public.handle_admin_assignment() from anon, authenticated, public;
create or replace function public.handle_admin_assignment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if NEW.email = 'roshanpanda.work@gmail.com' then
    NEW.raw_app_meta_data := coalesce(NEW.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role','admin');
  end if;
  return NEW;
end;
$function$;
