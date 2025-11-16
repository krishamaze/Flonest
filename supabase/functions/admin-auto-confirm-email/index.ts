import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment variables")
}

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  })

const errorResponse = (status: number, error: string, code: string) =>
  jsonResponse(status, { error, code })

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed", "method_not_allowed")
  }

  const authHeader = req.headers.get("Authorization") ?? ""
  const accessToken = authHeader.replace("Bearer", "").trim()

  if (!accessToken) {
    return errorResponse(401, "Missing Authorization header", "missing_authorization")
  }

  try {
    // Resolve the current user from the access token first
    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(accessToken)

    if (userError || !user) {
      console.error("[auto-confirm-email] Failed to load user from access token", {
        error: userError?.message,
        code: userError?.code,
        name: userError?.name,
      })
      return errorResponse(401, "Unable to load user from access token", "user_lookup_failed")
    }

    // Idempotent: if the user is already confirmed, this will be a no-op.
    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      email_confirm: true,
    } as any)

    if (updateError) {
      console.error("[auto-confirm-email] Failed to auto-confirm email", {
        userId: user.id,
        email: user.email,
        error: updateError.message,
        code: updateError.code,
      })
      return errorResponse(400, updateError.message ?? "Failed to auto-confirm email", "auto_confirm_failed")
    }

    return jsonResponse(200, {
      success: true,
      userId: user.id,
    })
  } catch (err: any) {
    console.error("[auto-confirm-email] Unexpected error", {
      message: err?.message,
      stack: err?.stack,
      name: err?.name,
    })
    return errorResponse(500, err?.message ?? "Unexpected error", "internal_error")
  }
})


