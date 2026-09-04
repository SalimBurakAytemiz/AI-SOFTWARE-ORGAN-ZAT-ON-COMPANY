/**
 * ADMIN FORM DURUM TİPLERİ - paylaşılan, "use server" OLMAYAN modül.
 *
 * NEDEN AYRI DOSYA: Bir `"use server"` dosyası YALNIZCA async fonksiyon export
 * edebilir (Next.js kuralı: "A 'use server' file can only export async
 * functions"). Server action modülleri (`.../actions.ts`) bu yüzden tip ve
 * sabit (idle state) export EDEMEZ; onlar burada durur ve hem server action'lar
 * hem istemci bileşenleri buradan import eder.
 */

/** `useActionState` ile kullanılan genel admin form sonucu. */
export interface FormState {
  ok: boolean;
  error: string | null;
  fieldErrors?: Record<string, string[]>;
  /** Başarı bilgi mesajı (ör. "Kaydedildi."). */
  notice?: string;
}

/** Form ilk render'ında kullanılan boş durum. */
export const idleFormState: FormState = { ok: false, error: null };

/** Admin giriş formu sonucu (yalnızca genel hata mesajı taşır). */
export interface LoginState {
  error: string | null;
}

export const idleLoginState: LoginState = { error: null };
