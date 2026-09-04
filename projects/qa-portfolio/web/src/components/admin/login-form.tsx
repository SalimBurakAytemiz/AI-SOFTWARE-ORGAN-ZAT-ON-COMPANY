"use client";

import { useActionState } from "react";
import { signInAction } from "@/app/[locale]/admin/login/actions";
import { type LoginState, idleLoginState } from "@/lib/admin/form-state";

/**
 * ADMIN GİRİŞ FORMU (istemci bileşeni).
 *
 * Tüm iş / güvenlik mantığı server action'da (`signInAction`): hız sınırı,
 * genel hata mesajı, allow-list yetki kontrolü, yönlendirme. Bu bileşen yalnızca
 * alanları ve bekleme/hata durumunu gösterir.
 */
export function LoginForm({ locale, next }: { locale: string; next?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    signInAction,
    idleLoginState,
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-[var(--text)]">
          E-posta
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-[var(--text)]">
          Parola
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
        />
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-[var(--radius-md)] border border-[var(--fail)] bg-[color-mix(in_srgb,var(--fail)_10%,transparent)] px-3 py-2 text-sm text-[var(--text)]"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-[var(--radius-md)] bg-[var(--text)] px-3 py-2 text-sm font-medium text-[var(--bg)] disabled:opacity-60"
      >
        {pending ? "Giriş yapılıyor…" : "Giriş yap"}
      </button>
    </form>
  );
}
