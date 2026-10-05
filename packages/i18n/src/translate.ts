import { formatMessage, type MessageParams } from './format';
import type { UiLocale } from './locales';
import type { Messages } from './messages/en';

// Looking messages up. This file has no catalogs in it, so a browser bundle
// that only needs the lookup (with messages handed to it by the server) does
// not carry every language.

type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** Every message, as "group.name". */
export type MessageKey = Leaves<Messages>;
export type MessageGroup = keyof Messages;

/** Some groups of a catalog: what a page hands its client components. */
export type PartialMessages = { [G in MessageGroup]?: Messages[G] };

export interface Translator {
  (key: MessageKey, params?: MessageParams): string;
  locale: UiLocale;
}

/**
 * A lookup for one language. `messages` may hold only some groups; asking for
 * a message that is not there returns its key, which shows up plainly in the
 * page rather than breaking it.
 */
export function createTranslator(locale: UiLocale, messages: PartialMessages): Translator {
  const translate = (key: MessageKey, params: MessageParams = {}): string => {
    const [group, name] = key.split('.') as [MessageGroup, string];
    const template = (messages[group] as Record<string, string> | undefined)?.[name];
    return template === undefined ? key : formatMessage(template, params, locale);
  };
  return Object.assign(translate, { locale });
}

/** The chosen groups of a catalog. */
export function pickMessages(messages: Messages, groups: readonly MessageGroup[]): PartialMessages {
  return Object.fromEntries(groups.map((group) => [group, messages[group]])) as PartialMessages;
}
