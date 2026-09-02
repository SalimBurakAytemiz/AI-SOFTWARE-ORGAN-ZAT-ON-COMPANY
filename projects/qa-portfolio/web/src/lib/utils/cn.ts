/**
 * Koşullu CSS sınıflarını birleştiren küçük yardımcı.
 * Harici bağımlılık (clsx/tailwind-merge) eklemeden basit birleştirme yapar
 * (planning/12 - minimal bağımlılık ilkesi).
 */
export type ClassValue = string | number | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
