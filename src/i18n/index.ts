import en, { type Messages } from "./messages/en";
import { defaultLocale, dirFor, type Locale } from "./config";

const messages: Record<Locale, Messages> = { en };

export const locale: Locale = defaultLocale;
export const dir = dirFor(locale);

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : T[K] extends readonly unknown[]
      ? never
      : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;

/** Look up a message by dotted key and fill {placeholders}. */
export function t(key: MessageKey, values?: Record<string, string | number>): string {
  const raw = key
    .split(".")
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], messages[locale]);
  const text = typeof raw === "string" ? raw : key;
  if (!values) return text;
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`));
}

/** Non-string message groups (lists of steps etc.). */
export function m(): Messages {
  return messages[locale];
}
