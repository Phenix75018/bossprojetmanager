CREATE OR REPLACE FUNCTION public.touch_parent_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  old_parent uuid;
  new_parent uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    old_parent := (to_jsonb(OLD) ->> TG_ARGV[1])::uuid;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    new_parent := (to_jsonb(NEW) ->> TG_ARGV[1])::uuid;
  END IF;
  IF old_parent IS NOT NULL THEN
    EXECUTE format('UPDATE public.%I SET updated_at = now() WHERE id = $1', TG_ARGV[0]) USING old_parent;
  END IF;
  IF new_parent IS NOT NULL AND new_parent IS DISTINCT FROM old_parent THEN
    EXECUTE format('UPDATE public.%I SET updated_at = now() WHERE id = $1', TG_ARGV[0]) USING new_parent;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.touch_parent_document() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER touch_budget_on_line_change
AFTER INSERT OR UPDATE OR DELETE ON public.budget_lines
FOR EACH ROW EXECUTE FUNCTION public.touch_parent_document('budgets', 'budget_id');
CREATE TRIGGER touch_business_plan_on_section_change
AFTER INSERT OR UPDATE OR DELETE ON public.business_plan_sections
FOR EACH ROW EXECUTE FUNCTION public.touch_parent_document('business_plans', 'business_plan_id');
CREATE TRIGGER touch_business_model_on_block_change
AFTER INSERT OR UPDATE OR DELETE ON public.business_model_blocks
FOR EACH ROW EXECUTE FUNCTION public.touch_parent_document('business_models', 'business_model_id');
CREATE TRIGGER touch_business_plan_section_on_chart_change
AFTER INSERT OR UPDATE OR DELETE ON public.business_plan_charts
FOR EACH ROW EXECUTE FUNCTION public.touch_parent_document('business_plan_sections', 'section_id');