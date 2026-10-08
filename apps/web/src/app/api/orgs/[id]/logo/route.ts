import { idSchema } from '@oathly/api/schemas';
import { getOrgLogo } from '@oathly/api/server';

import { getDb } from '@/lib/db';

// GET /api/orgs/<id>/logo?v=<version>: an organization's logo. Public, like
// any logo: it is shown to people before they have joined or signed in. The
// version in the address changes with the image, so it is cached for good.
export async function GET(_request: Request, { params }: RouteContext<'/api/orgs/[id]/logo'>) {
  const id = idSchema.safeParse((await params).id);
  const logo = id.success ? await getOrgLogo(getDb(), id.data) : null;
  if (!logo) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(logo.data), {
    headers: {
      'content-type': logo.contentType,
      'cache-control': 'public, max-age=31536000, immutable',
      etag: `"${logo.version}"`,
      // Served as the image it was checked to be, and nothing a browser may reinterpret.
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
    },
  });
}
