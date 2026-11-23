const BASE_HEADERS = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};

function allowedOrigins(): Set<string> {
  const configured = [Deno.env.get('APP_URL') || '', ...(Deno.env.get('ADDITIONAL_ALLOWED_ORIGINS') || '').split(',')]
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      try { return new URL(value).origin; } catch { return ''; }
    })
    .filter(Boolean);
  return new Set(configured);
}

export function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get('Origin');
  // Native/server-to-server requests may not send Origin. They still require auth/signatures.
  if (!origin) return true;
  return allowedOrigins().has(origin);
}

export function corsHeadersFor(req: Request): Record<string, string> {
  const headers: Record<string, string> = { ...BASE_HEADERS };
  const origin = req.headers.get('Origin');
  if (origin && isAllowedOrigin(req)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}
