-- Restrict the admin-only public-link RPC and pin the auth-assignment trigger's
-- search path. The public portal read/request endpoints remain token-authorized.
revoke all on function public.create_party_public_link(text) from public, anon;
grant execute on function public.create_party_public_link(text) to authenticated;

revoke all on function public.handle_admin_assignment() from public, anon, authenticated;
alter function public.handle_admin_assignment() set search_path = '';
