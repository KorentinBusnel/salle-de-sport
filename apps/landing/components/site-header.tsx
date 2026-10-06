import Link from "next/link";
import { header } from "@/content/landing";
import { Wordmark } from "@/components/logo";

/** En-tête collant : logo et un seul bouton, vers le formulaire du hero (§2.1). */
export function SiteHeader({ joinHref = "#inscription" }: { joinHref?: string }) {
  return (
    <header className="sticky top-0 z-10 bg-background/90 px-4 backdrop-blur-md sm:px-6">
      <div className="mx-auto flex min-h-[72px] max-w-[1200px] items-center justify-between gap-6">
        <Link
          href="/"
          aria-label={header.homeLabel}
          className="rounded-lg text-foreground transition-opacity hover:opacity-70"
        >
          <Wordmark className="text-[30px]" />
        </Link>
        <a
          href={joinHref}
          className="inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold tracking-[0.04em] text-primary-foreground uppercase transition-[background-color,scale] duration-150 hover:bg-primary-hover active:scale-[0.96]"
        >
          {header.join}
        </a>
      </div>
    </header>
  );
}
