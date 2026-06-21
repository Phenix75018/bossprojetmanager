
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.verify_share_password(plain_password text, hashed_password text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT hashed_password IS NOT NULL
    AND plain_password IS NOT NULL
    AND extensions.crypt(plain_password, hashed_password) = hashed_password;
$$;

GRANT EXECUTE ON FUNCTION public.verify_share_password(text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.hash_share_password_if_needed()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.share_password IS NOT NULL AND NEW.share_password <> '' THEN
    IF left(NEW.share_password, 2) <> '$2' THEN
      NEW.share_password := extensions.crypt(NEW.share_password, extensions.gen_salt('bf', 10));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['projects','calendar_shares','business_plans','business_models','budgets']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_hash_share_password ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_hash_share_password BEFORE INSERT OR UPDATE OF share_password ON public.%I FOR EACH ROW EXECUTE FUNCTION public.hash_share_password_if_needed()', t);
  END LOOP;
END $$;

UPDATE public.projects SET share_password = extensions.crypt(share_password, extensions.gen_salt('bf', 10)) WHERE share_password IS NOT NULL AND share_password <> '' AND left(share_password,2) <> '$2';
UPDATE public.calendar_shares SET share_password = extensions.crypt(share_password, extensions.gen_salt('bf', 10)) WHERE share_password IS NOT NULL AND share_password <> '' AND left(share_password,2) <> '$2';
UPDATE public.business_plans SET share_password = extensions.crypt(share_password, extensions.gen_salt('bf', 10)) WHERE share_password IS NOT NULL AND share_password <> '' AND left(share_password,2) <> '$2';
UPDATE public.business_models SET share_password = extensions.crypt(share_password, extensions.gen_salt('bf', 10)) WHERE share_password IS NOT NULL AND share_password <> '' AND left(share_password,2) <> '$2';
UPDATE public.budgets SET share_password = extensions.crypt(share_password, extensions.gen_salt('bf', 10)) WHERE share_password IS NOT NULL AND share_password <> '' AND left(share_password,2) <> '$2';
