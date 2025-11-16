import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Supabase project config
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? ""

// Cashfree config
const CASHFREE_ENABLED =
  (Deno.env.get("CASHFREE_ENABLED") ?? "false").toLowerCase() === "true"
const CASHFREE_CLIENT_ID = Deno.env.get("CASHFREE_CLIENT_ID") ?? ""
const CASHFREE_CLIENT_SECRET = Deno.env.get("CASHFREE_CLIENT_SECRET") ?? ""
const CASHFREE_PUBLIC_KEY = Deno.env.get("CASHFREE_PUBLIC_KEY") ?? ""
const CASHFREE_ENV = (Deno.env.get("CASHFREE_ENV") ?? "sandbox").toLowerCase()

// Prefer explicit base URL so we can switch sandbox/production cleanly
const CASHFREE_API_BASE_URL =
  Deno.env.get("CASHFREE_API_BASE_URL") ??
  (CASHFREE_ENV === "production"
    ? "https://api.cashfree.com"
    : "https://sandbox.cashfree.com")

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing Supabase environment variables")
}

// Cache imported Cashfree public key
let cashfreePublicKey: CryptoKey | null = null

const importCashfreePublicKey = async (): Promise<CryptoKey> => {
  if (cashfreePublicKey) return cashfreePublicKey

  if (!CASHFREE_PUBLIC_KEY) {
    throw new Error("Missing CASHFREE_PUBLIC_KEY environment variable")
  }

  // Expect a PEM-encoded RSA public key
  const pem = CASHFREE_PUBLIC_KEY.replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s+/g, "")

  const binary = atob(pem)
  const buffer = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i)
  }

  cashfreePublicKey = await crypto.subtle.importKey("spki", buffer, {
    name: "RSA-OAEP",
    // Cashfree examples use OPENSSL_PKCS1_OAEP_PADDING which defaults to SHA-1
    hash: "SHA-1",
  }, false, ["encrypt"])

  return cashfreePublicKey
}

const generateCashfreeSignature = async (): Promise<string> => {
  const key = await importCashfreePublicKey()
  const encoder = new TextEncoder()

  const ts = Math.floor(Date.now() / 1000)
  const payload = `${CASHFREE_CLIENT_ID}.${ts}`
  const data = encoder.encode(payload)

  // Log once to confirm payload shape; keep message generic to avoid leaking secrets
  console.log("[gst-validate] Cashfree signature payload", { payload })

  const encrypted = await crypto.subtle.encrypt(
    {
      name: "RSA-OAEP",
    },
    key,
    data,
  )

  const bytes = new Uint8Array(encrypted)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }

  return btoa(binary)
}

// Create a Supabase client that uses the incoming request's JWT for auth context
const createSupabaseClient = (accessToken: string | null) =>
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : {},
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

// Restrict CORS to known app origins
const ALLOWED_ORIGINS = [
  "https://bill.finetune.store",
  "https://billfinetune-finetunetechs-projects.vercel.app",
  "http://localhost:5173",
  "http://localhost:4173",
]

const buildCorsHeaders = (origin: string | null) => {
  const allowedOrigin =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  }
}

const jsonResponse = (
  status: number,
  body: Record<string, unknown>,
  origin: string | null,
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...buildCorsHeaders(origin),
    },
  })

const VALID_GST_STATE_CODES = new Set<string>([
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "30",
  "31",
  "32",
  "33",
  "34",
  "35",
  "36",
  "37",
])

const isStructurallyValidGSTIN = (gstin: string): boolean => {
  const value = gstin.trim().toUpperCase()

  // 15 chars, all [0-9A-Z]
  if (!/^[0-9A-Z]{15}$/.test(value)) return false

  // First 2 chars = valid state code
  const stateCode = value.slice(0, 2)
  if (!VALID_GST_STATE_CODES.has(stateCode)) return false

  // Next 10 chars must match PAN pattern: 5 letters, 4 digits, 1 letter
  const panPart = value.slice(2, 12)
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panPart)) return false

  // Last 3 chars already constrained by the 15-char regex (alphanumeric)
  return true
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin")

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: buildCorsHeaders(origin),
    })
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" }, origin)
  }

  if (
    CASHFREE_ENABLED &&
    (!CASHFREE_CLIENT_ID || !CASHFREE_CLIENT_SECRET || !CASHFREE_PUBLIC_KEY)
  ) {
    console.error("[gst-validate] Cashfree configuration missing")
    return jsonResponse(
      500,
      { error: "GST validation temporarily unavailable. Please try again later." },
      origin,
    )
  }

  const authHeader = req.headers.get("Authorization") ?? ""
  const accessToken = authHeader.replace("Bearer", "").trim() || null

  if (!accessToken) {
    return jsonResponse(401, { error: "Authentication required" }, origin)
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" }, origin)
  }

  const gstinRaw = (body?.gstin ?? "") as string
  const gstin = gstinRaw.trim().toUpperCase()

  if (!gstin || !isStructurallyValidGSTIN(gstin)) {
    return jsonResponse(
      400,
      {
        error:
          "Invalid GSTIN structure. Please check the number and ensure it matches the official format.",
      },
      origin,
    )
  }

  try {
    const supabase = createSupabaseClient(accessToken)

    // Resolve current user to log and optionally scope further (e.g., by org)
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error("[gst-validate] Failed to resolve user from access token", {
        error: userError?.message,
        code: userError?.code,
      })
      return jsonResponse(401, { error: "Authentication required" }, origin)
    }

    console.log("[gst-validate] GST validation request", {
      userId: user.id,
      email: user.email,
      gstin,
    })

    if (!CASHFREE_ENABLED) {
      const normalized = {
        gstin,
        legal_name: null,
        trade_name: null,
        address: {
          building: null,
          street: null,
          city: null,
          state: null,
          pincode: null,
        },
        gstin_status: "unverified",
        registration_type: null,
        verification_source: "manual",
      }

      console.log("[gst-validate] Cashfree disabled, returning structural validation only", {
        userId: user.id,
        gstin,
        gstin_status: normalized.gstin_status,
        verification_source: normalized.verification_source,
      })

      return jsonResponse(200, normalized as Record<string, unknown>, origin)
    }

    const url = `${CASHFREE_API_BASE_URL}/verification/gstin`

    const signature = await generateCashfreeSignature()

    const cfRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": CASHFREE_CLIENT_ID,
        "x-client-secret": CASHFREE_CLIENT_SECRET,
        "x-cf-signature": signature,
      },
      body: JSON.stringify({ gstin }),
    })

    const payload = await cfRes
      .json()
      .catch(() => ({ message: "Unable to parse Cashfree response" }))

    if (!cfRes.ok) {
      console.error("[gst-validate] Cashfree GST validation failed", {
        status: cfRes.status,
        gstin,
        userId: user.id,
        message: payload?.message,
      })

      const isNotFound =
        cfRes.status === 404 ||
        (typeof payload?.message === "string" &&
          payload.message.toLowerCase().includes("not found"))

      return jsonResponse(
        400,
        {
          error: isNotFound
            ? "GSTIN not found. Please verify the number and try again."
            : "Unable to validate GSTIN at the moment. Please try again later.",
        },
        origin,
      )
    }

    // Map Cashfree payload into the GSTBusinessData shape used by SetupPage
    const normalized = {
      gstin,
      legal_name: payload?.business_name ?? payload?.legal_name ?? null,
      trade_name: payload?.trade_name ?? null,
      address: {
        building: payload?.address?.building ?? null,
        street: payload?.address?.street ?? null,
        city: payload?.address?.city ?? null,
        state: payload?.address?.state ?? null,
        pincode: payload?.address?.pincode ?? null,
      },
      gstin_status: payload?.status ?? payload?.gstin_status ?? null,
      registration_type: payload?.registration_type ?? null,
      verification_source: "cashfree",
    }

    console.log("[gst-validate] GST validation success", {
      userId: user.id,
      gstin,
      status: normalized.gstin_status,
    })

    return jsonResponse(200, normalized as Record<string, unknown>, origin)
  } catch (err: any) {
    console.error("[gst-validate] Unexpected error", {
      message: err?.message,
      stack: err?.stack,
    })
    return jsonResponse(
      500,
      { error: "Unexpected error while validating GSTIN. Please try again later." },
      origin,
    )
  }
})


