import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Dil farkında (locale-aware) gezinme yardımcıları.
 * <Link>, useRouter, redirect, usePathname bileşenlerini buradan kullanın;
 * böylece dil öneki (/tr, /en) otomatik korunur ve dil değiştirildiğinde
 * aynı sayfada kalınır (planning/12 CF-18, review R2).
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
