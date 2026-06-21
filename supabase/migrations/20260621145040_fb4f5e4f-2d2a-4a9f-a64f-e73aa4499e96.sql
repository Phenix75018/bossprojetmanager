
REVOKE EXECUTE ON FUNCTION public.verify_share_password(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_share_password(text, text) TO service_role;
