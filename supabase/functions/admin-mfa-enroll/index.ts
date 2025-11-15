// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string,
) => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${operation} timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    }),
  ])
}

const runWithRetries = async <T>(
  fn: () => Promise<T>,
  operation: string,
  timeoutMs: number,
  delays = [500, 1000, 2000],
) => {
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    const attemptStart = Date.now()
    console.log(`[DEBUG] runWithRetries: ${operation} - Attempt ${attempt + 1}/${delays.length + 1}`)
    try {
      const result = await withTimeout(fn(), timeoutMs, operation)
      console.log(`[DEBUG] runWithRetries: ${operation} - Attempt ${attempt + 1} succeeded in ${Date.now() - attemptStart}ms`)
      return result
    } catch (err: any) {
      const elapsed = Date.now() - attemptStart
      const message = err?.message?.toLowerCase() ?? ""
      const isRetryable =
        message.includes("timed out") ||
        message.includes("fetch failed") ||
        message.includes("network")

      console.log(`[DEBUG] runWithRetries: ${operation} - Attempt ${attempt + 1} failed after ${elapsed}ms:`, {
        error: err?.message,
        isRetryable,
        willRetry: isRetryable && attempt < delays.length,
      })

      if (!isRetryable || attempt === delays.length) {
        throw err
      }

      const delay = delays[attempt] ?? delays[delays.length - 1]
      console.log(`[DEBUG] runWithRetries: ${operation} - Waiting ${delay}ms before retry`)
      await wait(delay)
    }
  }

  throw new Error(`${operation} failed after retries`)
}

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

const getUserAndProfile = async (accessToken: string) => {
  const {
    data: { user },
    error,
  } = await adminClient.auth.getUser(accessToken)

  if (error || !user) {
    throw new Error("Unable to load user from access token")
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("platform_admin")
    .eq("id", user.id)
    .single()

  if (profileError || !profile?.platform_admin) {
    throw new Error("Platform admin access required")
  }

  return user.id
}

const createUserClient = (accessToken: string) =>
  createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })

const cleanupUnverified = async (userClient: ReturnType<typeof createClient>) => {
  const { data, error } = await userClient.auth.mfa.listFactors()
  if (error || !data?.totp) return

  for (const factor of data.totp) {
    if (factor.status === "unverified") {
      await userClient.auth.mfa.unenroll({ factorId: factor.id })
    }
  }
}

const handleStatus = async (accessToken: string) => {
  const startTime = Date.now()
  console.log("[DEBUG] handleStatus: Starting at", new Date().toISOString())
  
  try {
    console.log("[DEBUG] handleStatus: Calling getUserAndProfile")
    const getUserStart = Date.now()
    await getUserAndProfile(accessToken)
    console.log("[DEBUG] handleStatus: getUserAndProfile completed in", Date.now() - getUserStart, "ms")
    
    console.log("[DEBUG] handleStatus: Creating userClient")
    const userClient = createUserClient(accessToken)

    // Use retry logic for listFactors as it can be slow
    console.log("[DEBUG] handleStatus: Starting listFactors with retries")
    const listStart = Date.now()
    const listResult = await runWithRetries(
      () => {
        console.log("[DEBUG] handleStatus: listFactors attempt starting")
        return userClient.auth.mfa.listFactors()
      },
      "List MFA factors",
      5000, // 5 second timeout per attempt (frontend has 20s total timeout)
      [500, 1000], // Only 2 retries to stay under 20s total
    )
    console.log("[DEBUG] handleStatus: listFactors completed in", Date.now() - listStart, "ms")

    const { data, error } = listResult
    if (error) {
      console.error("[DEBUG] handleStatus: listFactors error:", error)
      throw new Error(error.message ?? "Unable to list MFA factors")
    }

    console.log("[DEBUG] handleStatus: Found", data?.totp?.length ?? 0, "TOTP factors")
    const verifiedFactor = data?.totp?.find((factor) => factor.status === "verified")

    if (verifiedFactor) {
      console.log("[DEBUG] handleStatus: Found verified factor:", verifiedFactor.id, "Total time:", Date.now() - startTime, "ms")
      return jsonResponse(200, {
        hasVerifiedFactor: true,
        factorId: verifiedFactor.id,
      })
    }

    console.log("[DEBUG] handleStatus: No verified factor found. Total time:", Date.now() - startTime, "ms")
    return jsonResponse(200, {
      hasVerifiedFactor: false,
    })
  } catch (err: any) {
    console.error("[DEBUG] handleStatus: Error after", Date.now() - startTime, "ms:", err)
    throw err
  }
}

const handleStart = async (accessToken: string, body: any) => {
  const userId = await getUserAndProfile(accessToken)
  const userClient = createUserClient(accessToken)

  const action = body?.action ?? "enroll"

  if (action !== "enroll") {
    return jsonResponse(400, { error: "Invalid action for /start. Use /status for status checks." })
  }

  await cleanupUnverified(userClient)

  const enrollResult = await runWithRetries(
    () =>
      userClient.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Platform Admin ${Date.now()}`,
      }),
    "Enroll TOTP factor",
    10000,
  )

  const enrollError = enrollResult.error
  const enrollData = enrollResult.data

  if (enrollError || !enrollData?.id) {
    throw new Error(enrollError?.message ?? "Failed to enroll TOTP factor")
  }

  const qrCode = (enrollData as any).qr_code ?? enrollData.totp?.qr_code
  const secret = (enrollData as any).secret ?? enrollData.totp?.secret ?? ""

  if (!qrCode) {
    throw new Error("Failed to generate TOTP QR code")
  }

  return jsonResponse(200, {
    mode: "enrollment",
    factorId: enrollData.id,
    qrCode,
    secret,
  })
}

const handleVerify = async (accessToken: string, body: any) => {
  await getUserAndProfile(accessToken)
  const { factorId, code } = body ?? {}

  if (!factorId || !code) {
    return jsonResponse(400, { error: "factorId and code are required" })
  }

  const userClient = createUserClient(accessToken)

  const challengeResult = await runWithRetries(
    () =>
      userClient.auth.mfa.challenge({
        factorId,
      }),
    "Create enrollment challenge",
    10000,
  )

  const challengeError = challengeResult.error
  const challenge = challengeResult.data

  if (challengeError || !challenge?.id) {
    throw new Error(challengeError?.message ?? "Failed to create challenge")
  }

  const verifyResult = await runWithRetries(
    () =>
      userClient.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      }),
    "Verify MFA code",
    10000,
  )

  const verifyError = verifyResult.error

  if (verifyError) {
    throw new Error(verifyError.message ?? "Invalid verification code")
  }

  return jsonResponse(200, { success: true })
}

Deno.serve(async (req) => {
  const requestStart = Date.now()
  const url = new URL(req.url)
  const segments = url.pathname.split("/")
  const action = segments.pop() ?? ""

  console.log("[DEBUG] Request received:", {
    method: req.method,
    url: req.url,
    pathname: url.pathname,
    segments: segments,
    action: action,
    timestamp: new Date().toISOString(),
  })

  const authHeader = req.headers.get("Authorization") ?? ""
  const accessToken = authHeader.replace("Bearer", "").trim()

  if (req.method === "OPTIONS") {
    console.log("[DEBUG] OPTIONS request, returning CORS headers")
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  if (!accessToken) {
    console.error("[DEBUG] Missing access token")
    return jsonResponse(401, { error: "Missing Authorization header" })
  }

  if (req.method !== "POST") {
    console.error("[DEBUG] Invalid method:", req.method)
    return jsonResponse(405, { error: "Method not allowed" })
  }

  try {
    console.log("[DEBUG] Parsing request body")
    const body = await req.json().catch(() => ({}))
    console.log("[DEBUG] Request body parsed, action:", action)

    if (action === "status") {
      console.log("[DEBUG] Routing to handleStatus")
      const result = await handleStatus(accessToken)
      console.log("[DEBUG] handleStatus completed in", Date.now() - requestStart, "ms")
      return result
    }

    if (action === "start") {
      console.log("[DEBUG] Routing to handleStart")
      return await handleStart(accessToken, body)
    }

    if (action === "verify") {
      console.log("[DEBUG] Routing to handleVerify")
      return await handleVerify(accessToken, body)
    }

    console.error("[DEBUG] Unknown action:", action)
    return jsonResponse(404, { error: "Not found" })
  } catch (err: any) {
    console.error("[DEBUG] Error after", Date.now() - requestStart, "ms:", {
      message: err?.message,
      stack: err?.stack,
      name: err?.name,
    })
    return jsonResponse(500, { error: err?.message ?? "Unexpected error" })
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:0/functions/v1/admin-mfa-enroll' \
    --header 'Authorization: Bearer ' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
