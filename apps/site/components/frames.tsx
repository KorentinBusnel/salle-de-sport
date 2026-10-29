import Image, { type StaticImageData } from "next/image";
import { cn } from "@/lib/cn";

// Rayons imbriqués (skill B3) : rayon intérieur = rayon extérieur − marge (2xl 16 − 8 = lg 8,
// 4xl 32 − 8 = 3xl 24).

/** Capture du back office dans un cadre clair. */
export function ProductFrame({
  src,
  alt,
  className,
  preload = false,
  sizes = "(min-width: 1024px) 680px, 100vw",
}: {
  src: StaticImageData;
  alt: string;
  className?: string;
  preload?: boolean;
  sizes?: string;
}) {
  return (
    <div className={cn("rounded-2xl bg-neutral-100 p-2 shadow-border", className)}>
      <Image
        src={src}
        alt={alt}
        sizes={sizes}
        preload={preload}
        placeholder="blur"
        className="h-auto w-full rounded-lg"
      />
    </div>
  );
}

/** Capture de l'app adhérent dans un cadre de téléphone. */
export function PhoneFrame({
  src,
  alt,
  className,
}: {
  src: StaticImageData;
  alt: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-4xl bg-neutral-900 p-2 shadow-border-hover", className)}>
      <Image
        src={src}
        alt={alt}
        sizes="224px"
        placeholder="blur"
        className="h-auto w-full rounded-3xl"
      />
    </div>
  );
}
