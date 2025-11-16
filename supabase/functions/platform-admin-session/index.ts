import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment variables");
}

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const ALLOWED_ORIGINS = new Set([
  "https://biz.finetune.store",
  "https://bill.finetune.store",
  "http://localhost:3000",
]);

const COOKIE_NAME = "ft_admin";
const MAX_AGE_SECONDS = 8 * 60 * 60; // 8 hours

const encoder = new TextEncoder();

const hashToken = async (token: string) => {
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://biz.finetune.store";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
};

const parseAccessToken = async (req: Request): Promise<string> => {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  try {
    const body = await req.json();
    return (body as any)?.access_token ?? "";
  } catch {
    return "";
  }
};

const getUserId = async (accessToken: string): Promise<string> => {
  const { data, error } = await adminClient.auth.getUser(accessToken);
  if (error || !data?.user) {
    throw new Error("Invalid access token");
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, platform_admin")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile?.platform_admin) {
    throw new Error("Platform admin access required");
  }

  return profile.id as string;
};

const serializeCookie = (value: string, maxAge?: number) => {
  const parts = [`${COOKIE_NAME}=${value}`];

  parts.push("HttpOnly", "Secure", "SameSite=Strict", "Path=/", "Domain=bill.finetune.store");

  if (maxAge !== undefined) {
    parts.push(`Max-Age=${maxAge}`);
  }

  return parts.join("; ");
};

const respond = (status: number, body: Record<string, unknown>, headers: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });

const handleCreate = async (req: Request, origin: string | null) => {
  const corsHeaders = getCorsHeaders(origin);
  const accessToken = await parseAccessToken(req);

  if (!accessToken) {
    return respond(
      401,
      {
        error: "Missing access token",
      },
      corsHeaders,
    );
  }

  try {
    const userId = await getUserId(accessToken);

    const rawToken =
      crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const tokenHash = await hashToken(rawToken);
    const expiresAt = new Date(Date.now() + MAX_AGE_SECONDS * 1000).toISOString();

    const { error } = await adminClient.from("admin_sessions").insert({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    if (error) {
      throw error;
    }

    const headers = new Headers(corsHeaders);
    headers.set("Set-Cookie", serializeCookie(rawToken, MAX_AGE_SECONDS));

    return respond(
      200,
      {
        success: true,
      },
      headers,
    );
  } catch (err: any) {
    return respond(
      401,
      {
        error: err?.message ?? "Unauthorized",
      },
      corsHeaders,
    );
  }
};

const readCookieToken = (req: Request): string => {
  const cookieHeader = req.headers.get("Cookie") ?? "";
  const parts = cookieHeader.split(";").map((p) => p.trim());

  for (const part of parts) {
    if (part.startsWith(`${COOKIE_NAME}=`)) {
      return part.slice(COOKIE_NAME.length + 1);
    }
  }

  return "";
};

const clearCookieAndRespond = (
  status: number,
  body: Record<string, unknown>,
  corsHeaders: HeadersInit,
) => {
  const headers = new Headers(corsHeaders);
  headers.set("Set-Cookie", serializeCookie("", 0));
  return respond(status, body, headers);
};

const handleValidate = async (req: Request, origin: string | null) => {
  const corsHeaders = getCorsHeaders(origin);
  const rawToken = readCookieToken(req);

  if (!rawToken) {
    return clearCookieAndRespond(
      401,
      {
        error: "Missing session",
      },
      corsHeaders,
    );
  }

  const tokenHash = await hashToken(rawToken);
  const { data, error } = await adminClient
    .from("admin_sessions")
    .select("id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (
    error ||
    !data ||
    (data as any).revoked_at ||
    new Date((data as any).expires_at) < new Date()
  ) {
    return clearCookieAndRespond(
      401,
      {
        error: "Invalid session",
      },
      corsHeaders,
    );
  }

  return respond(
    200,
    {
      valid: true,
    },
    corsHeaders,
  );
};

const handleRevoke = async (req: Request, origin: string | null) => {
  const corsHeaders = getCorsHeaders(origin);
  const rawToken = readCookieToken(req);

  if (!rawToken) {
    return clearCookieAndRespond(
      200,
      {
        revoked: true,
      },
      corsHeaders,
    );
  }

  const tokenHash = await hashToken(rawToken);
  await adminClient
    .from("admin_sessions")
    .update({
      revoked_at: new Date().toISOString(),
    })
    .eq("token_hash", tokenHash);

  return clearCookieAndRespond(
    200,
    {
      revoked: true,
    },
    corsHeaders,
  );
};

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/*$/, "");

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: getCorsHeaders(origin),
    });
  }

  if (path.endsWith("/create") && req.method === "POST") {
    return handleCreate(req, origin);
  }

  if (path.endsWith("/validate") && req.method === "GET") {
    return handleValidate(req, origin);
  }

  if (path.endsWith("/revoke") && req.method === "POST") {
    return handleRevoke(req, origin);
  }

  return respond(
    404,
    {
      error: "Not found",
    },
    getCorsHeaders(origin),
  );
});


