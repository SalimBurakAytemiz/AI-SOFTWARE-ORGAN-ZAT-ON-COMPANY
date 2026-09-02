import { cn } from "@/lib/utils/cn";

/**
 * İçerik genişliğini ve yatay boşlukları tek yerden yöneten kapsayıcı
 * (planning/06 §6.5). "prose" varyantı okunabilir metin genişliği (68ch) verir.
 */
export function Container({
  as: Tag = "div",
  prose = false,
  className,
  children,
}: {
  as?: React.ElementType;
  prose?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tag
      className={cn(
        "mx-auto w-full px-4 sm:px-6 lg:px-8",
        prose ? "max-w-[68ch]" : "max-w-[1200px]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
