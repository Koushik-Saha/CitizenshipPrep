import type { Me } from '@oathly/api';
import { orgLogoPath, type OrgBrand } from '@oathly/api/org';
import { getOrgAccess, type OrgAccess } from '@oathly/api/server';
import { isOrgAdmin } from '@oathly/core';
import { localizePath, type UiLocale } from '@oathly/i18n';
import { notFound, redirect } from 'next/navigation';

import { getDb } from './db';
import { requireMe, type SignedInUser } from './user';

/**
 * The organization at this address, for someone who runs it. Signed-out
 * visitors go to sign in, people outside it get a 404, and its learners are
 * sent to the page that says who they study with.
 */
export async function requireOrgAdmin(
  locale: UiLocale,
  slug: string,
): Promise<{ user: SignedInUser; me: Me; access: OrgAccess }> {
  const { user, me } = await requireMe(locale);
  const access = await getOrgAccess(getDb(), user.userId, { slug });
  if (!access) notFound();
  if (!isOrgAdmin(access.role)) redirect(localizePath(locale, '/org'));
  return { user, me, access };
}

/** Where an organization's logo loads from, or null without one. */
export function logoSrc(organization: { id: string; brand: OrgBrand }): string | null {
  const version = organization.brand.logoVersion;
  return version ? orgLogoPath(organization.id, version) : null;
}
