import Link from "next/link";
import { notFound } from "@/content/landing";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <>
      <SiteHeader joinHref="/#inscription" />
      <main className="flex flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="font-serif text-[clamp(36px,5vw,48px)] leading-[1.1] font-normal">
          {notFound.title}
        </h1>
        <p className="text-muted-foreground">{notFound.text}</p>
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold tracking-[0.04em] text-primary-foreground uppercase hover:bg-primary-hover"
        >
          {notFound.back}
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
