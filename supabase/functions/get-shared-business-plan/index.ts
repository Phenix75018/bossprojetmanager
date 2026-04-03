import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { token, password } = await req.json();

    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "Token manquant" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: bp, error } = await supabase
      .from("business_plans")
      .select("*")
      .eq("share_token", token)
      .single();

    if (error || !bp) {
      return new Response(JSON.stringify({ error: "Business plan introuvable" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (bp.share_password) {
      if (!password) {
        return new Response(JSON.stringify({ error: "password_required" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: match } = await supabase.rpc("verify_share_password", {
        input_password: password,
        hashed_password: bp.share_password,
      });
      if (!match) {
        return new Response(JSON.stringify({ error: "Mot de passe incorrect" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: sections } = await supabase
      .from("business_plan_sections")
      .select("*")
      .eq("business_plan_id", bp.id)
      .order("sort_order");

    return new Response(JSON.stringify({
      businessPlan: {
        title: bp.title,
        description: bp.description,
        status: bp.status,
        created_at: bp.created_at,
      },
      sections: sections || [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("get-shared-business-plan error:", e);
    return new Response(
      JSON.stringify({ error: "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
