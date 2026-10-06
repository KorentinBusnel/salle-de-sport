import { formatMoney, mpSavingPercent } from "@salle/shared";
import { PackageIcon, SearchIcon, SparklesIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AddToCart } from "@/components/marketplace/add-to-cart";
import { type CartLine, CartSheet } from "@/components/marketplace/cart-sheet";
import { QuoteDialog } from "@/components/marketplace/quote-dialog";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { isManagerRole, requireRole } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: t("marketplace.tab.catalog") };

/** Sans accents ni casse, pour la recherche. */
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * Catalogue de la marketplace (gérant) : produits à prix réseau (prix public barré, paliers de
 * volume) et services sur devis ; panier de la salle.
 */
export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categorie?: string }>;
}) {
  const params = await searchParams;
  const context = await requireRole(isManagerRole);
  const supabase = await createClient();
  const [{ data: categories }, { data: products }, { data: cart }] = await Promise.all([
    supabase.from("mp_categories").select("id, name").order("position").order("name"),
    supabase
      .from("mp_products")
      .select(
        "id, kind, category_id, name, brand, description, unit, image_path, list_price_cents, price_cents, mp_price_tiers(min_qty, unit_price_cents)",
      )
      .eq("is_active", true)
      .order("position")
      .order("name"),
    supabase.from("mp_cart_items").select("product_id, quantity").eq("gym_id", context.gym.id),
  ]);

  const query = fold((params.q ?? "").trim());
  const category = (categories ?? []).find((c) => c.id === params.categorie)?.id ?? null;
  const visible = (products ?? []).filter(
    (p) =>
      (!category || p.category_id === category) &&
      (!query || fold(`${p.name} ${p.brand ?? ""} ${p.description ?? ""}`).includes(query)),
  );
  const inCart = new Map((cart ?? []).map((row) => [row.product_id, row.quantity]));
  const lines: CartLine[] = (cart ?? []).flatMap((row) => {
    const product = (products ?? []).find((p) => p.id === row.product_id);
    return product && product.price_cents !== null
      ? [
          {
            productId: product.id,
            name: product.name,
            unit: product.unit,
            quantity: row.quantity,
            priceCents: product.price_cents,
            tiers: product.mp_price_tiers,
          },
        ]
      : [];
  });
  const imageUrl = (path: string | null) =>
    path ? supabase.storage.from("marketplace").getPublicUrl(path).data.publicUrl : null;
  const href = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: params.q ?? null, categorie: category, ...changes }))
      if (v) next.set(k, v);
    const text = next.toString();
    return `/marketplace${text ? `?${text}` : ""}`;
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t("marketplace.tab.catalog")}
        description={t("marketplace.hint")}
        actions={
          <>
            <QuoteDialog label={t("marketplace.quote.newRequest")} />
            <CartSheet lines={lines} />
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <form action="/marketplace" className="relative w-full max-w-sm">
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          {category ? <input type="hidden" name="categorie" value={category} /> : null}
          <Input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder={t("marketplace.search")}
            aria-label={t("marketplace.search")}
            className="pl-8"
          />
        </form>
        <nav aria-label={t("marketplace.tab.catalog")} className="flex flex-wrap gap-1.5">
          {[{ id: null, name: t("marketplace.allCategories") }, ...(categories ?? [])].map((c) => (
            <Link
              key={c.id ?? "all"}
              href={href({ categorie: c.id })}
              aria-current={c.id === category ? "page" : undefined}
              className={cn(
                "rounded-full px-3 py-1 text-sm transition-colors pointer-coarse:py-2",
                c.id === category
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {c.name}
            </Link>
          ))}
        </nav>
      </div>

      {visible.length === 0 ? (
        <Empty className="rounded-xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackageIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>{t("marketplace.empty")}</EmptyTitle>
            <EmptyDescription>{t("marketplace.emptyHint")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => {
            const image = imageUrl(p.image_path);
            const saving =
              p.price_cents !== null ? mpSavingPercent(p.list_price_cents, p.price_cents) : null;
            const tiers = [...p.mp_price_tiers].sort((a, b) => a.min_qty - b.min_qty);
            return (
              <li key={p.id} className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-border">
                <div className="flex gap-3">
                  <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- image publique du catalogue
                      <img src={image} alt="" className="size-full object-cover" />
                    ) : p.kind === "service" ? (
                      <SparklesIcon aria-hidden className="size-6 text-muted-foreground" />
                    ) : (
                      <PackageIcon aria-hidden className="size-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[p.brand, p.unit].filter(Boolean).join(" · ")}
                    </p>
                    {p.kind === "service" ? (
                      <Badge variant="secondary" className="mt-1">
                        {t("marketplace.service")}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                {p.description ? (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                ) : null}
                <div className="mt-auto grid gap-2">
                  {p.price_cents !== null && p.kind === "product" ? (
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-lg font-semibold tabular-nums">
                        {formatMoney(p.price_cents, "eur")}
                      </span>
                      {p.unit ? (
                        <span className="text-xs text-muted-foreground">
                          {t("marketplace.perUnit", { unit: p.unit })}
                        </span>
                      ) : null}
                      {saving ? (
                        <>
                          <span className="text-xs text-muted-foreground line-through tabular-nums">
                            {formatMoney(p.list_price_cents ?? 0)}
                          </span>
                          <Badge className="bg-success/10 text-success">
                            {t("marketplace.saving", { percent: saving })}
                          </Badge>
                        </>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm font-medium">{t("marketplace.onQuote")}</p>
                  )}
                  {tiers.length ? (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      <span className="font-medium text-foreground">
                        {t("marketplace.tiers")} :{" "}
                      </span>
                      {tiers
                        .map((tier) =>
                          t("marketplace.tierFrom", {
                            count: tier.min_qty,
                            price: formatMoney(tier.unit_price_cents),
                          }),
                        )
                        .join(" · ")}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    {p.kind === "product" && p.price_cents !== null ? (
                      <AddToCart productId={p.id} name={p.name} inCart={inCart.get(p.id) ?? 0} />
                    ) : null}
                    <QuoteDialog
                      productId={p.id}
                      productName={p.name}
                      variant={p.kind === "service" ? "default" : "outline"}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
