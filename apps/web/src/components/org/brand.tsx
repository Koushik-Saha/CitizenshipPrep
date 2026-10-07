import type { OrgBrand } from '@oathly/api/org';
import { brandCss } from '@oathly/tokens';

/** The class that a branded part of a page carries. */
export const BRAND_CLASS = 'org-brand';

/**
 * An organization's colours, for everything inside an element with
 * BRAND_CLASS. The colours are six hex digits by the time they are stored,
 * and brandCss refuses anything else, so nothing here can break out of the
 * stylesheet. Renders nothing when the organization has picked no colour.
 */
export function BrandStyle({ brand }: { brand: Pick<OrgBrand, 'color' | 'accent'> }) {
  const css = brandCss(`.${BRAND_CLASS}`, brand);
  return css ? <style>{css}</style> : null;
}

/** An organization's logo, sized by its height. Decorative next to the name; pass `alt` when it stands alone. */
export function OrgLogo({
  src,
  alt = '',
  className = 'h-9',
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  return (
    // A stored upload at a versioned address: next/image would only re-encode it.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={`${className} w-auto max-w-40 object-contain`} />
  );
}
