import { getAuth } from '@/lib/auth/server';

// Proxies sign-in requests to Neon Auth and sets this site's session cookies.
type Context = { params: Promise<{ path: string[] }> };

export function GET(request: Request, context: Context) {
  return getAuth().handler().GET(request, context);
}

export function POST(request: Request, context: Context) {
  return getAuth().handler().POST(request, context);
}
