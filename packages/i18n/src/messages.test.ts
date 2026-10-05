import { describe, expect, it } from 'vitest';

import { formatMessage, messageShape } from './format';
import { textDirection } from './index';
import { uiLocales, type UiLocale } from './locales';
import { catalogs, translatorFor } from './messages';

const flatten = (locale: UiLocale): Map<string, string> => {
  const out = new Map<string, string>();
  for (const [group, messages] of Object.entries(catalogs[locale])) {
    for (const [name, message] of Object.entries(messages)) out.set(`${group}.${name}`, message);
  }
  return out;
};

const english = flatten('en');
const sample = { count: 3, shown: 2, total: 5, date: 'today', explanations: 20, messages: 15 };

describe('message catalogs', () => {
  it('cover every UI language', () => {
    expect(Object.keys(catalogs).sort()).toEqual([...uiLocales].sort());
  });

  for (const locale of uiLocales) {
    describe(locale, () => {
      const messages = flatten(locale);

      it('has exactly the English keys, none empty', () => {
        expect([...messages.keys()].sort()).toEqual([...english.keys()].sort());
        for (const [key, message] of messages) {
          expect(message.trim(), key).not.toBe('');
        }
      });

      it('uses the same placeholders as the English', () => {
        for (const [key, message] of messages) {
          expect(messageShape(message).names, key).toEqual(messageShape(english.get(key)!).names);
        }
      });

      it('gives every plural an "other" form and only forms the language has', () => {
        const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
        for (const [key, message] of messages) {
          for (const [name, options] of Object.entries(messageShape(message).plurals)) {
            expect(options, `${key} {${name}}`).toContain('other');
            for (const option of options) {
              expect(
                option.startsWith('=') || categories.includes(option as Intl.LDMLPluralRule),
                `${key}: "${option}" is not a plural form in ${locale}`,
              ).toBe(true);
            }
          }
        }
      });

      it('formats every message without leaving braces behind', () => {
        for (const [key, message] of messages) {
          const params = Object.fromEntries(
            messageShape(message).names.map((name) => [
              name,
              sample[name as keyof typeof sample] ?? `<${name}>`,
            ]),
          );
          for (const count of [0, 1, 2, 5, 11, 100]) {
            const text = formatMessage(message, { ...params, count }, locale);
            expect(text, key).not.toMatch(/[{}]/);
          }
        }
      });
    });
  }

  it('reads right to left only for Arabic among the UI languages', () => {
    expect(uiLocales.filter((locale) => textDirection(locale) === 'rtl')).toEqual(['ar']);
  });

  it('translates through translatorFor', () => {
    expect(translatorFor('es')('common.signIn')).toBe('Iniciar sesión');
    expect(translatorFor('en')('exam.questionCount', { count: 1 })).toBe('1 question');
    expect(translatorFor('ar')('exam.questionCount', { count: 2 })).toBe('سؤالان');
    expect(translatorFor('ar')('exam.questionCount', { count: 5 })).toBe('5 أسئلة');
    expect(translatorFor('zh-Hans')('exam.countdownDays', { count: 1 })).toBe('明天考试');
  });
});
