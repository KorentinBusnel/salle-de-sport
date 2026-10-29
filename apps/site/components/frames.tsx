import Image, { type StaticImageData } from "next/image";
import { cn } from "@/lib/cn";

// Rayons imbriqués des tokens (packages/ui) : rayon intérieur = rayon extérieur − marge
// (2xl 18 − 8 = lg 10, 4xl 26 − 8 = 2xl 18).

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
        className="h-auto w-full rounded-2xl"
      />
    </div>
  );
}
