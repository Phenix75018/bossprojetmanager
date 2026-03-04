import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Non autorisé");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) throw new Error("Non autorisé");

    const { email, projectId, shareUrl, projectTitle, senderName } = await req.json();
    if (!email || !shareUrl || !projectTitle) throw new Error("Paramètres manquants");

    // Verify project ownership if projectId is provided
    if (projectId) {
      const { data: project } = await supabase
        .from("projects")
        .select("id, user_id")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .single();
      if (!project) throw new Error("Projet introuvable");
    }

    const displayName = senderName || user.email;

    const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="font-size: 24px; color: #7c2d12; margin: 0;">📋 Plan d'action partagé</h1>
      </div>
      <p style="color: #44403c; font-size: 16px; line-height: 1.6;">
        <strong>${displayName}</strong> a partagé un plan d'action avec vous :
      </p>
      <div style="background: #fef7f0; border: 1px solid #fed7aa; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <h2 style="margin: 0 0 8px; color: #7c2d12; font-size: 20px;">${projectTitle}</h2>
      </div>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${shareUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c2d12, #9a3412); color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 16px;">
          Voir le plan d'action
        </a>
      </div>
      <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 32px 0;" />
      <p style="color: #a8a29e; font-size: 12px; text-align: center;">Boss Project Manager</p>
    </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Boss PM <onboarding@resend.dev>",
        to: [email],
        subject: `📋 ${displayName} a partagé "${projectTitle}" avec vous`,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Erreur email: ${body}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
