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


-- A party has one reusable live portal link. This constraint is required by
-- the upsert below and prevents duplicate active/public links for a party.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.party_public_links'::regclass
      AND conname='party_public_links_party_code_key'
  ) THEN
    ALTER TABLE public.party_public_links
      ADD CONSTRAINT party_public_links_party_code_key UNIQUE (party_code);
  END IF;
END $$;

-- Create/reuse a party's live portal link safely. The unique party_code
-- constraint makes concurrent button clicks idempotent.
CREATE OR REPLACE FUNCTION public.create_party_public_link(p_party_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_slug text;
  v_token text;
  v_id bigint;
BEGIN
  IF coalesce(public.my_role(),'') <> 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.parties WHERE code=p_party_code) THEN
    RAISE EXCEPTION 'Party not found';
  END IF;

  SELECT public_slug, token, id
    INTO v_slug, v_token, v_id
  FROM public.party_public_links
  WHERE party_code=p_party_code
  ORDER BY active DESC, id DESC
  LIMIT 1;

  IF v_id IS NULL THEN
    v_slug := 'c-' || substr(md5(random()::text || clock_timestamp()::text || p_party_code),1,12);
    v_token := 'sd_pt_' || substr(md5(random()::text || clock_timestamp()::text || p_party_code),1,24);

    INSERT INTO public.party_public_links(party_code,token,public_slug,active)
    VALUES(p_party_code,v_token,v_slug,true)
    ON CONFLICT (party_code) DO UPDATE
      SET active=true
      RETURNING id, public_slug, token
      INTO v_id, v_slug, v_token;
  ELSIF NOT coalesce((SELECT active FROM public.party_public_links WHERE id=v_id),false) THEN
    UPDATE public.party_public_links SET active=true WHERE id=v_id;
  END IF;

  RETURN jsonb_build_object('ok',true,'public_slug',v_slug,'token',v_token);
END
$function$;

REVOKE EXECUTE ON FUNCTION public.create_party_public_link(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_party_public_link(text) TO authenticated;

