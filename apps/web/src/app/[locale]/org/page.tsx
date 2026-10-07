import { orgKinds, isOrgAdmin } from '@oathly/core';
import { localizePath } from '@oathly/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';

import { OrgLogo } from '@/components/org/brand';
import { ProblemNotice } from '@/components/org/org-chrome';
import { Badge, buttonClass, fieldClass, focusRing, labelClass } from '@/components/ui';
import { getT } from '@/lib/i18n';
import { logoSrc } from '@/lib/org';
import { requireMe } from '@/lib/user';

import { createOrg, leave } from './actions';

export async function generateMetadata({ params }: PageProps<'/[locale]/org'>): Promise<Metadata> {
  return { title: (await getT(params)).t('org.metaTitle') };
}

const kindLabel = {
  law_firm: 'org.kindLawFirm',
  school: 'org.kindSchool',
  nonprofit: 'org.kindNonprofit',
  other: 'org.kindOther',
} as const;
const roleLabel = {
  owner: 'org.roleOwner',
  admin: 'org.roleAdmin',
  member: 'org.roleMember',
} as const;

// The organizations someone runs or studies with, and the way to start one.
export default async function Organizations({ params, searchParams }: PageProps<'/[locale]/org'>) {
  const { locale, t } = await getT(params);
  const { me } = await requireMe(locale);
  const card = 'bg-surface border-border rounded-lg border p-5 sm:p-6';

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <p className="text-sm">
        <Link
          href={localizePath(locale, '/study')}
          prefetch
          className={`${focusRing} text-primary-fg rounded-xs underline`}
        >
          {t('common.backToStudy')}
        </Link>
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold">{t('org.title')}</h1>
      <p className="text-fg-muted mt-3 max-w-prose">{t('org.intro')}</p>
      <ProblemNotice t={t} problem={(await searchParams).error} />

      {me.organizations.length > 0 && (
        <section aria-labelledby="yours" className="mt-10">
          <h2 id="yours" className="font-display text-2xl font-semibold">
            {t('org.yours')}
          </h2>
          <ul className="mt-4 space-y-3">
            {me.organizations.map((membership) => {
              const logo = logoSrc({ id: membership.organizationId, brand: membership.brand });
              return (
                <li key={membership.organizationId} className={card}>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    {logo && <OrgLogo src={logo} />}
                    <p className="font-display text-xl font-semibold">{membership.name}</p>
                    <Badge>{t(roleLabel[membership.role])}</Badge>
                    {isOrgAdmin(membership.role) && (
                      <Link
                        href={localizePath(locale, `/org/${membership.slug}`)}
                        prefetch
                        className={`${buttonClass.secondary} ms-auto`}
                      >
                        {t('org.open')}
                      </Link>
                    )}
                  </div>
                  {membership.role === 'member' && (
                    <>
                      <p className="text-fg-muted mt-3 text-sm">{t('org.adminsSee')}</p>
                      <form action={leave} className="mt-4">
                        <input
                          type="hidden"
                          name="organizationId"
                          value={membership.organizationId}
                        />
                        <button type="submit" className={buttonClass.secondary}>
                          {t('org.leave', { organization: membership.name })}
                        </button>
                      </form>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="create" className={`${card} mt-10`}>
        <h2 id="create" className="font-display text-2xl font-semibold">
          {t('org.create')}
        </h2>
        <form action={createOrg} className="mt-5 space-y-4">
          <div>
            <label htmlFor="org-name" className={labelClass}>
              {t('org.name')}
            </label>
            <input
              id="org-name"
              name="name"
              required
              maxLength={120}
              autoComplete="organization"
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="org-kind" className={labelClass}>
              {t('org.kind')}
            </label>
            <select id="org-kind" name="kind" className={fieldClass} defaultValue="law_firm">
              {orgKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {t(kindLabel[kind])}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={buttonClass.primary}>
            {t('org.createButton')}
          </button>
        </form>
      </section>

      <p className="text-fg-muted mt-10 text-sm">{t('common.notAffiliated')}</p>
    </main>
  );
}
