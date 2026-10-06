import {
  formatMoney,
  MP_CAMPAIGN_STATUS_TONE,
  MP_ORDER_STATUS_TONE,
  MP_QUOTE_STATUS_TONE,
  zonedDateKey,
} from "@salle/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { AddRow } from "@/components/inline/add-row";
import { EditableCell } from "@/components/inline/editable-cell";
import { PageHeader } from "@/components/page-header";
import { CampaignActions, NewCampaign } from "@/components/platform/campaign-controls";
import {
  AnswerQuote,
  ImageUpload,
  OrderStatusButtons,
  TiersDialog,
} from "@/components/platform/platform-controls";
import { StatusPill } from "@/components/status-pill";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { gymFormatters } from "@/lib/format";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import {
  createCategory,
  createProduct,
  createSupplier,
  updateCategory,
  updateProduct,
  updateSupplier,
} from "./actions";

export const metadata: Metadata = { title: t("platform.title") };

const TABS = ["catalogue", "fournisseurs", "devis", "commandes", "achats-groupes"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL = {
  catalogue: "platform.tab.catalogue",
  fournisseurs: "platform.tab.suppliers",
  devis: "platform.tab.quotes",
  commandes: "platform.tab.orders",
  "achats-groupes": "platform.tab.campaigns",
} as const;

/**
 * Espace Plateforme (administrateurs) : catalogue commun de la marketplace édité sur place,
 * fournisseurs, réponses aux devis et suivi des commandes de toutes les salles.
 */
export default async function PlatformPage({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string }>;
}) {
  const params = await searchParams;
  const context = await requireRole((role) => role === "admin");
  const tab: Tab = TABS.find((x) => x === params.onglet) ?? "catalogue";

  return (
    <div className="grid gap-6">
      <PageHeader title={t("platform.title")} description={t("platform.hint")} />
      <nav
        aria-label={t("platform.title")}
        className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl bg-muted p-1"
      >
        {TABS.map((x) => (
          <Link
            key={x}
            href={`/plateforme?onglet=${x}`}
            aria-current={x === tab ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors pointer-coarse:py-2.5",
              x === tab
                ? "bg-card font-medium text-foreground shadow-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(TAB_LABEL[x])}
          </Link>
        ))}
      </nav>
      {tab === "catalogue" ? (
        <CatalogTab />
      ) : tab === "fournisseurs" ? (
        <SuppliersTab />
      ) : tab === "devis" ? (
        <QuotesTab timeZone={context.gym.timezone} />
      ) : tab === "achats-groupes" ? (
        <CampaignsTab timeZone={context.gym.timezone} />
      ) : (
        <OrdersTab timeZone={context.gym.timezone} />
      )}
    </div>
  );
}

async function CatalogTab() {
  const supabase = await createClient();
  const [{ data: products }, { data: categories }, { data: suppliers }, { data: costs }] =
    await Promise.all([
      supabase
        .from("mp_products")
        .select(
          "id, kind, name, brand, unit, category_id, supplier_id, list_price_cents, price_cents, is_active, mp_price_tiers(min_qty, unit_price_cents)",
        )
        .order("position")
        .order("name"),
      supabase.from("mp_categories").select("id, name").order("position").order("name"),
      supabase.from("mp_suppliers").select("id, name").order("name"),
      supabase.from("mp_product_costs").select("product_id, cost_cents"),
    ]);
  const cost = new Map((costs ?? []).map((row) => [row.product_id, row.cost_cents]));
  const categoryOptions = (categories ?? []).map((c) => ({ value: c.id, label: c.name }));
  const supplierOptions = (suppliers ?? []).map((s) => ({ value: s.id, label: s.name }));
  const kindOptions = [
    { value: "product", label: t("platform.kindProduct") },
    { value: "service", label: t("platform.kindService") },
  ];
  const dash = <span className="px-2 text-muted-foreground">{t("platform.none")}</span>;

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("platform.products")}</CardTitle>
          <CardDescription>{t("platform.productsHint")}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-2">
          <Table className="min-w-[92rem]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <span className="sr-only">{t("platform.image")}</span>
                </TableHead>
                <TableHead className="w-60">{t("platform.name")}</TableHead>
                <TableHead className="w-28">{t("platform.kind")}</TableHead>
                <TableHead className="w-40">{t("platform.category")}</TableHead>
                <TableHead className="w-44">{t("platform.supplier")}</TableHead>
                <TableHead className="w-32">{t("platform.brand")}</TableHead>
                <TableHead className="w-36">{t("platform.unit")}</TableHead>
                <TableHead className="w-28">{t("platform.listPrice")}</TableHead>
                <TableHead className="w-28">{t("platform.price")}</TableHead>
                <TableHead className="w-28">{t("platform.cost")}</TableHead>
                <TableHead className="w-20">{t("platform.margin")}</TableHead>
                <TableHead className="w-56">{t("platform.tiers")}</TableHead>
                <TableHead className="w-20">{t("platform.active")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(products ?? []).map((p) => {
                const product = p.kind === "product";
                const c = cost.get(p.id);
                const margin =
                  product && p.price_cents && c !== undefined
                    ? Math.round(((p.price_cents - c) / p.price_cents) * 100)
                    : null;
                return (
                  <TableRow key={p.id} data-row-id={p.id} className="hover:bg-transparent">
                    <TableCell className="p-1">
                      <ImageUpload productId={p.id} name={p.name} />
                    </TableCell>
                    <TableCell className="p-1">
                      <EditableCell
                        kind="text"
                        id={p.id}
                        field="name"
                        label={t("platform.name")}
                        value={p.name}
                        maxLength={120}
                        action={updateProduct}
                        className="font-medium"
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <EditableCell
                        kind="select"
                        id={p.id}
                        field="kind"
                        label={`${t("platform.kind")} : ${p.name}`}
                        value={p.kind}
                        options={kindOptions}
                        action={updateProduct}
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <EditableCell
                        kind="select"
                        id={p.id}
                        field="category_id"
                        label={`${t("platform.category")} : ${p.name}`}
                        value={p.category_id}
                        options={categoryOptions}
                        clearable
                        action={updateProduct}
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <EditableCell
                        kind="select"
                        id={p.id}
                        field="supplier_id"
                        label={`${t("platform.supplier")} : ${p.name}`}
                        value={p.supplier_id}
                        options={supplierOptions}
                        clearable
                        action={updateProduct}
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <EditableCell
                        kind="text"
                        id={p.id}
                        field="brand"
                        label={`${t("platform.brand")} : ${p.name}`}
                        value={p.brand ?? ""}
                        maxLength={80}
                        action={updateProduct}
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <EditableCell
                        kind="text"
                        id={p.id}
                        field="unit"
                        label={`${t("platform.unit")} : ${p.name}`}
                        value={p.unit ?? ""}
                        maxLength={60}
                        action={updateProduct}
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      {product ? (
                        <EditableCell
                          kind="number"
                          id={p.id}
                          field="list_price"
                          label={`${t("platform.listPrice")} : ${p.name}`}
                          value={(p.list_price_cents ?? 0) / 100}
                          min={0}
                          max={1000000}
                          step={0.5}
                          decimals={2}
                          money
                          action={updateProduct}
                        />
                      ) : (
                        dash
                      )}
                    </TableCell>
                    <TableCell className="p-1">
                      {product ? (
                        <EditableCell
                          kind="number"
                          id={p.id}
                          field="price"
                          label={`${t("platform.price")} : ${p.name}`}
                          value={(p.price_cents ?? 0) / 100}
                          min={0}
                          max={1000000}
                          step={0.5}
                          decimals={2}
                          money
                          action={updateProduct}
                        />
                      ) : (
                        dash
                      )}
                    </TableCell>
                    <TableCell className="p-1">
                      {product ? (
                        <EditableCell
                          kind="number"
                          id={p.id}
                          field="cost"
                          label={`${t("platform.cost")} : ${p.name}`}
                          value={(c ?? 0) / 100}
                          min={0}
                          max={1000000}
                          step={0.5}
                          decimals={2}
                          money
                          action={updateProduct}
                        />
                      ) : (
                        dash
                      )}
                    </TableCell>
                    <TableCell className="px-2 text-sm text-muted-foreground tabular-nums">
                      {margin !== null ? `${margin} %` : t("platform.none")}
                    </TableCell>
                    <TableCell className="p-1">
                      {product ? (
                        <TiersDialog
                          productId={p.id}
                          name={p.name}
                          tiers={[...p.mp_price_tiers].sort((a, b) => a.min_qty - b.min_qty)}
                        />
                      ) : (
                        dash
                      )}
                    </TableCell>
                    <TableCell className="p-1">
                      <EditableCell
                        kind="switch"
                        id={p.id}
                        field="is_active"
                        label={`${t("platform.active")} : ${p.name}`}
                        value={p.is_active}
                        action={updateProduct}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              <AddRow label={t("platform.newProduct")} action={createProduct} colSpan={13} />
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>{t("platform.categories")}</CardTitle>
        </CardHeader>
        <CardContent className="px-2">
          <Table>
            <TableBody>
              {(categories ?? []).map((c) => (
                <TableRow key={c.id} data-row-id={c.id} className="hover:bg-transparent">
                  <TableCell className="p-1">
                    <EditableCell
                      kind="text"
                      id={c.id}
                      field="name"
                      label={t("platform.category")}
                      value={c.name}
                      maxLength={60}
                      action={updateCategory}
                    />
                  </TableCell>
                </TableRow>
              ))}
              <AddRow label={t("platform.newCategory")} action={createCategory} colSpan={1} />
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

async function SuppliersTab() {
  const supabase = await createClient();
  const { data: suppliers } = await supabase
    .from("mp_suppliers")
    .select("id, name, contact_name, email, phone, notes")
    .order("name");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("platform.suppliers")}</CardTitle>
        <CardDescription>{t("platform.suppliersHint")}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto px-2">
        <Table className="min-w-[60rem]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-56">{t("platform.name")}</TableHead>
              <TableHead className="w-44">{t("platform.contact")}</TableHead>
              <TableHead className="w-56">{t("platform.email")}</TableHead>
              <TableHead className="w-40">{t("platform.phone")}</TableHead>
              <TableHead>{t("platform.notes")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(suppliers ?? []).map((s) => (
              <TableRow key={s.id} data-row-id={s.id} className="hover:bg-transparent">
                <TableCell className="p-1">
                  <EditableCell
                    kind="text"
                    id={s.id}
                    field="name"
                    label={t("platform.name")}
                    value={s.name}
                    maxLength={120}
                    action={updateSupplier}
                    className="font-medium"
                  />
                </TableCell>
                <TableCell className="p-1">
                  <EditableCell
                    kind="text"
                    id={s.id}
                    field="contact_name"
                    label={`${t("platform.contact")} : ${s.name}`}
                    value={s.contact_name ?? ""}
                    maxLength={120}
                    action={updateSupplier}
                  />
                </TableCell>
                <TableCell className="p-1">
                  <EditableCell
                    kind="text"
                    id={s.id}
                    field="email"
                    label={`${t("platform.email")} : ${s.name}`}
                    value={s.email ?? ""}
                    maxLength={160}
                    action={updateSupplier}
                  />
                </TableCell>
                <TableCell className="p-1">
                  <EditableCell
                    kind="text"
                    id={s.id}
                    field="phone"
                    label={`${t("platform.phone")} : ${s.name}`}
                    value={s.phone ?? ""}
                    maxLength={40}
                    action={updateSupplier}
                  />
                </TableCell>
                <TableCell className="p-1">
                  <EditableCell
                    kind="text"
                    id={s.id}
                    field="notes"
                    label={`${t("platform.notes")} : ${s.name}`}
                    value={s.notes ?? ""}
                    maxLength={2000}
                    multiline
                    action={updateSupplier}
                  />
                </TableCell>
              </TableRow>
            ))}
            <AddRow label={t("platform.newSupplier")} action={createSupplier} colSpan={5} />
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

async function QuotesTab({ timeZone }: { timeZone: string }) {
  const supabase = await createClient();
  const format = gymFormatters(timeZone);
  const { data: quotes } = await supabase
    .from("mp_quotes")
    .select(
      "id, title, quantity, message, status, unit_price_cents, valid_until, created_at, gyms(name), mp_products(price_cents)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  const pending = (quotes ?? []).filter((q) => q.status === "requested");
  const others = (quotes ?? []).filter((q) => q.status !== "requested");
  const inTwoWeeks = new Date(currentTime().getTime() + 14 * 86_400_000).toISOString().slice(0, 10);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("platform.quotesToAnswer")}</CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("platform.quotesEmpty")}</p>
          ) : (
            <ul className="grid gap-4">
              {pending.map((q) => (
                <li key={q.id} className="grid gap-2 border-b pb-4 last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium">
                      {q.quantity} × {q.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {q.gyms?.name} · {format.dateTime(q.created_at)}
                    </p>
                    {q.message ? <p className="mt-1 text-sm">{q.message}</p> : null}
                  </div>
                  <AnswerQuote
                    quoteId={q.id}
                    defaultPrice={q.mp_products?.price_cents ?? null}
                    defaultUntil={inTwoWeeks}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {others.length ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("platform.otherQuotes")}</CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            <Table>
              <TableBody>
                {others.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="pl-2">
                      <span className="block font-medium">
                        {q.quantity} × {q.title}
                      </span>
                      <span className="text-xs text-muted-foreground">{q.gyms?.name}</span>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {q.unit_price_cents !== null
                        ? formatMoney(q.unit_price_cents)
                        : t("platform.none")}
                    </TableCell>
                    <TableCell className="pr-2 text-right">
                      <StatusPill tone={MP_QUOTE_STATUS_TONE[q.status]}>
                        {t(`marketplace.quotes.status.${q.status}`)}
                      </StatusPill>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

async function OrdersTab({ timeZone }: { timeZone: string }) {
  const supabase = await createClient();
  const format = gymFormatters(timeZone);
  const { data: orders } = await supabase
    .from("mp_orders")
    .select(
      "id, reference, status, total_cents, currency, created_at, gyms(name), mp_order_items(name, quantity)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  return (
    <Card>
      <CardContent className="overflow-x-auto px-2">
        {!orders?.length ? (
          <p className="px-2 text-sm text-muted-foreground">{t("platform.ordersEmpty")}</p>
        ) : (
          <Table className="min-w-[56rem]">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-2">{t("marketplace.orders.reference")}</TableHead>
                <TableHead>{t("platform.gym")}</TableHead>
                <TableHead>{t("marketplace.orders.items")}</TableHead>
                <TableHead>{t("marketplace.orders.status")}</TableHead>
                <TableHead className="text-right">{t("marketplace.orders.total")}</TableHead>
                <TableHead className="pr-2 text-right">
                  <span className="sr-only">{t("marketplace.orders.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="pl-2">
                    <span className="block font-medium">{o.reference}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {format.dateTime(o.created_at)}
                    </span>
                  </TableCell>
                  <TableCell>{o.gyms?.name}</TableCell>
                  <TableCell className="max-w-72">
                    <span className="block truncate text-sm">
                      {o.mp_order_items.map((i) => `${i.quantity} × ${i.name}`).join(", ")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusPill tone={MP_ORDER_STATUS_TONE[o.status]}>
                      {t(`marketplace.orders.statusLabel.${o.status}`)}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMoney(o.total_cents, o.currency)}
                  </TableCell>
                  <TableCell className="pr-2">
                    <OrderStatusButtons id={o.id} status={o.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

async function CampaignsTab({ timeZone }: { timeZone: string }) {
  const supabase = await createClient();
  const format = gymFormatters(timeZone);
  const [{ data: campaigns }, { data: products }] = await Promise.all([
    supabase.rpc("mp_campaign_progress"),
    supabase
      .from("mp_products")
      .select("id, name")
      .eq("kind", "product")
      .eq("is_active", true)
      .not("price_cents", "is", null)
      .order("name"),
  ]);
  const inTwoWeeks = zonedDateKey(new Date(currentTime().getTime() + 14 * 86_400_000), timeZone);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("platform.campaigns.new")}</CardTitle>
          <CardDescription>{t("platform.campaigns.hint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <NewCampaign products={products ?? []} defaultEndsOn={inTwoWeeks} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="overflow-x-auto px-2">
          {!campaigns?.length ? (
            <p className="px-2 text-sm text-muted-foreground">{t("platform.campaigns.empty")}</p>
          ) : (
            <Table className="min-w-[56rem]">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-2">{t("platform.campaigns.titleField")}</TableHead>
                  <TableHead>{t("platform.campaigns.endsOn")}</TableHead>
                  <TableHead className="text-right">{t("platform.campaigns.total")}</TableHead>
                  <TableHead className="text-right">{t("platform.campaigns.price")}</TableHead>
                  <TableHead>{t("platform.campaigns.status")}</TableHead>
                  <TableHead className="pr-2 text-right">
                    <span className="sr-only">{t("marketplace.orders.actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="pl-2">
                      <span className="block font-medium">{c.title}</span>
                      <span className="text-xs text-muted-foreground">{c.product_name}</span>
                    </TableCell>
                    <TableCell className="tabular-nums">{format.fullDate(c.ends_at)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="block">
                        {c.total_qty} / {c.min_qty}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t("marketplace.groupBuy.gyms", { count: c.gyms })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(c.unit_price_cents)}
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={MP_CAMPAIGN_STATUS_TONE[c.status]}>
                        {t(`platform.campaigns.statusLabel.${c.status}`)}
                      </StatusPill>
                    </TableCell>
                    <TableCell className="pr-2">
                      {c.status === "open" ? <CampaignActions id={c.id} title={c.title} /> : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
