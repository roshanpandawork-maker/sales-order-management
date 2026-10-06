-- Restore the application-facing role check.
-- my_role() is SECURITY DEFINER and returns only the caller's role.
-- The frontend needs EXECUTE to perform the login authorization check.
grant execute on function public.my_role() to authenticated;

-- Keep the helper non-public to anonymous users.
revoke execute on function public.my_role() from anon;

-- The dashboard role helper is also intentionally callable by signed-in users.
grant execute on function public.get_dashboard_role() to authenticated;
revoke execute on function public.get_dashboard_role() from anon;
