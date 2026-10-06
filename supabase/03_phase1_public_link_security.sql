-- SalesDesk Phase 1 security hardening.
-- Customer live-balance RPCs are intentionally public-link endpoints.
-- They must remain callable by anon, but signed-in app users do not need
-- direct execution because the bearer token is the authorization boundary.

revoke execute on function public.get_party_live_balance(text) from public;
revoke execute on function public.get_party_live_balance(text) from authenticated;
grant execute on function public.get_party_live_balance(text) to anon;

revoke execute on function public.get_party_live_balance_by_slug(text) from public;
revoke execute on function public.get_party_live_balance_by_slug(text) from authenticated;
grant execute on function public.get_party_live_balance_by_slug(text) to anon;

-- my_role() is an internal RLS helper. It should not be exposed as a client RPC.
revoke execute on function public.my_role() from public;
revoke execute on function public.my_role() from authenticated;
