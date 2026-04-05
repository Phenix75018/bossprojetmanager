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

    const { data: bm, error } = await supabase
      .from("business_models")
      .select("*")
      .eq("share_token", token)
      .single();

    if (error || !bm) {
      return new Response(JSON.stringify({ error: "Business model introuvable" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (bm.share_password) {
      if (!password) {
        return new Response(JSON.stringify({ error: "password_required" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: match } = await supabase.rpc("verify_share_password", {
        input_password: password,
        hashed_password: bm.share_password,
      });
      if (!match) {
        return new Response(JSON.stringify({ error: "Mot de passe incorrect" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: blocks } = await supabase
      .from("business_model_blocks")
      .select("*")
      .eq("business_model_id", bm.id)
      .order("sort_order");

    return new Response(JSON.stringify({
      businessModel: {
        title: bm.title,
        description: bm.description,
        framework: bm.framework,
        status: bm.status,
        created_at: bm.created_at,
      },
      blocks: blocks || [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("get-shared-business-model error:", e);
    return new Response(
      JSON.stringify({ error: "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
