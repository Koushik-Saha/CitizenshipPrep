import qrcode from 'qrcode-generator';

// A QR code, drawn on the server as an SVG. Used for the address an
// authenticator app scans to add an account, so the picture is made here and
// never by another site: what it holds is a secret.

/** Quiet space around the code, in modules. Scanners want four. */
const MARGIN = 4;

/**
 * The code for a piece of text, as an SVG document: black modules on white,
 * whatever the page's colours, because that is what a phone's camera reads.
 */
export function qrSvg(text: string): string {
  // Type 0 picks the smallest code the text fits in; M survives a smudge.
  const code = qrcode(0, 'M');
  code.addData(text);
  code.make();
  const count = code.getModuleCount();
  const size = count + MARGIN * 2;
  let path = '';
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (code.isDark(row, col)) path += `M${col + MARGIN},${row + MARGIN}h1v1h-1z`;
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
    `<rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`
  );
}

/** The same code as an address an <img> can show. */
export function qrDataUri(text: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(qrSvg(text)).toString('base64')}`;
}
