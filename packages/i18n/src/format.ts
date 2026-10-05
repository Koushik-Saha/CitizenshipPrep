// A small message formatter: the part of ICU MessageFormat the apps use.
//
//   "Study for {country}"                                   a named value
//   "{count, plural, one {# question} other {# questions}}" a plural; # is the number
//
// Plural categories come from Intl.PluralRules, so Arabic gets its six forms
// and Chinese its one. An exact match ("=0 {None}") wins over a category, and
// "other" is the fallback every plural must have.

export type MessageParams = Record<string, string | number>;

interface PluralPart {
  name: string;
  options: Map<string, Part[]>;
}
type Part = string | { name: string } | PluralPart | { pound: true };

const parsed = new Map<string, Part[]>();

/** Reads parts up to the closing brace of the enclosing block (or the end). */
function parseParts(source: string, start: number, inPlural: boolean): [Part[], number] {
  const parts: Part[] = [];
  let text = '';
  let i = start;
  const flush = () => {
    if (text) parts.push(text);
    text = '';
  };
  while (i < source.length) {
    const char = source[i]!;
    if (char === '}') break;
    if (char === '#' && inPlural) {
      flush();
      parts.push({ pound: true });
      i += 1;
    } else if (char === '{') {
      flush();
      const [part, next] = parseArgument(source, i + 1);
      parts.push(part);
      i = next;
    } else {
      text += char;
      i += 1;
    }
  }
  flush();
  return [parts, i];
}

/** Reads "{name}" or "{name, plural, ...}" from just after its opening brace. */
function parseArgument(source: string, start: number): [Part, number] {
  const close = source.indexOf('}', start);
  const comma = source.indexOf(',', start);
  if (close === -1) throw new Error(`Unclosed "{" in message: ${source}`);
  if (comma === -1 || comma > close) {
    return [{ name: source.slice(start, close).trim() }, close + 1];
  }
  const name = source.slice(start, comma).trim();
  const kindEnd = source.indexOf(',', comma + 1);
  const kind = source.slice(comma + 1, kindEnd).trim();
  if (kindEnd === -1 || kind !== 'plural') {
    throw new Error(`Only "plural" is supported, in message: ${source}`);
  }
  const options = new Map<string, Part[]>();
  let i = kindEnd + 1;
  for (;;) {
    while (source[i] === ' ' || source[i] === '\n') i += 1;
    if (source[i] === '}') return [{ name, options }, i + 1];
    const open = source.indexOf('{', i);
    if (open === -1) throw new Error(`Unclosed plural in message: ${source}`);
    const key = source.slice(i, open).trim();
    const [parts, end] = parseParts(source, open + 1, true);
    if (source[end] !== '}') throw new Error(`Unclosed plural option in message: ${source}`);
    options.set(key, parts);
    i = end + 1;
  }
}

function render(parts: Part[], params: MessageParams, locale: string, count?: number): string {
  let out = '';
  for (const part of parts) {
    if (typeof part === 'string') out += part;
    else if ('pound' in part) out += String(count);
    else if ('options' in part) {
      const value = Number(params[part.name]);
      const chosen =
        part.options.get(`=${value}`) ??
        part.options.get(new Intl.PluralRules(locale).select(value)) ??
        part.options.get('other');
      if (!chosen) throw new Error(`Plural "${part.name}" has no "other" option.`);
      out += render(chosen, params, locale, value);
    } else {
      const value = params[part.name];
      out += value === undefined ? `{${part.name}}` : String(value);
    }
  }
  return out;
}

/** Fills a message's placeholders and picks its plural forms for `locale`. */
export function formatMessage(template: string, params: MessageParams, locale: string): string {
  // Most messages are plain text: skip the parser.
  if (!template.includes('{')) return template;
  let parts = parsed.get(template);
  if (!parts) {
    const [read, end] = parseParts(template, 0, false);
    if (end !== template.length) throw new Error(`Unexpected "}" in message: ${template}`);
    parts = read;
    parsed.set(template, parts);
  }
  return render(parts, params, locale);
}

/** The placeholders a message uses and, per plural, its option keys: for checking translations. */
export function messageShape(template: string): {
  names: string[];
  plurals: Record<string, string[]>;
} {
  const names = new Set<string>();
  const plurals: Record<string, string[]> = {};
  const visit = (parts: Part[]) => {
    for (const part of parts) {
      if (typeof part === 'string' || 'pound' in part) continue;
      names.add(part.name);
      if ('options' in part) {
        plurals[part.name] = [...part.options.keys()];
        for (const option of part.options.values()) visit(option);
      }
    }
  };
  visit(parseParts(template, 0, false)[0]);
  return { names: [...names].sort(), plurals };
}

/**
 * Wraps text that may be in another language (a question, a quote from a
 * guide, a name from the database) so it keeps its own direction inside a
 * sentence: without this, English inside an Arabic sentence scrambles its
 * punctuation and numbers. The marks are invisible.
 */
export function isolate(text: string): string {
  return `\u2068${text}\u2069`;
}
