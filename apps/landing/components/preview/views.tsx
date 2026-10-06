import { preview, type Step, type StepId, type Tone } from "@/content/landing";

/**
 * Vues de l'aperçu (§2.3), rendues côté serveur : tout leur texte est dans le HTML, même pour
 * les vues inactives (vérifié par scripts/check-html.mjs). Données de démonstration.
 */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-xs font-medium tracking-[0.04em] text-muted-foreground uppercase">
      {children}
    </p>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`flex min-w-0 flex-col rounded-xl border border-border p-4 sm:p-5 ${className}`}
    >
      {children}
    </div>
  );
}

/** Carte sombre de l'assistant, avec son action proposée (illustration, non cliquable). */
function Assistant({
  label,
  message,
  action,
}: {
  label?: string;
  message: string;
  action: string;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-foreground p-5 text-white">
      {label ? (
        <p className="font-mono text-xs font-medium tracking-[0.04em] text-faint uppercase">
          {label}
        </p>
      ) : null}
      <p className="text-sm leading-normal">{message}</p>
      <ActionPill>{action}</ActionPill>
    </div>
  );
}

function ActionPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="self-start rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold tracking-[0.04em] text-primary-foreground uppercase">
      {children}
    </span>
  );
}

const TONE_BORDER: Record<Tone, string> = {
  terracotta: "border-terracotta",
  success: "border-success",
  info: "border-info",
};

function StatusTag({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-block rounded-lg border px-2 py-0.5 text-xs ${TONE_BORDER[tone]}`}>
      {children}
    </span>
  );
}

function SoftTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="self-start rounded-lg bg-primary/10 px-2 py-0.5 text-xs text-primary-hover">
      {children}
    </span>
  );
}

function Metric({ children, size = "lg" }: { children: React.ReactNode; size?: "lg" | "md" }) {
  return (
    <p
      className={`font-mono leading-[1.1] tabular-nums ${size === "lg" ? "text-[32px]" : "text-[28px]"}`}
    >
      {children}
    </p>
  );
}

function Quotidien() {
  const v = preview.quotidien;
  return (
    <div className="stagger flex flex-wrap gap-3">
      <Card className="flex-[1.4_1_320px] gap-3.5 text-sm">
        <Label>{v.classesTitle}</Label>
        {v.classes.map((c) => {
          const full = c.booked >= c.capacity;
          return (
            <div key={c.time} className="flex flex-col gap-1.5">
              <div className="flex justify-between gap-3">
                <span>
                  {c.time} · {c.discipline}
                </span>
                <span className={`font-mono tabular-nums ${full ? "" : "text-muted-foreground"}`}>
                  {c.booked}/{c.capacity}
                  {c.waiting > 0 ? ` · ${c.waiting} ${v.waitingSuffix}` : ""}
                </span>
              </div>
              <div aria-hidden="true" className="h-1.5 rounded-full bg-muted">
                <div
                  className={`bar h-1.5 rounded-full ${full ? "bg-foreground" : "bg-terracotta"}`}
                  style={{ width: `${Math.round((c.booked / c.capacity) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </Card>
      <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-3">
        <Card className="gap-2.5 bg-background text-sm">
          <Label>{v.inboxTitle}</Label>
          {v.inbox.map((item) => (
            <div key={item.channel} className="flex justify-between">
              <span>{item.channel}</span>
              <span
                className={`font-mono tabular-nums ${item.highlight ? "rounded-lg bg-primary/10 px-2 text-primary-hover" : ""}`}
              >
                {item.count}
              </span>
            </div>
          ))}
        </Card>
        <Assistant
          label={v.assistantLabel}
          message={v.assistantMessage}
          action={v.assistantAction}
        />
      </div>
    </div>
  );
}

function Dashboard() {
  const v = preview.dashboard;
  return (
    <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
      <Card className="gap-2">
        <Label>{v.fill.label}</Label>
        <Metric>{v.fill.value}</Metric>
        <svg
          aria-hidden="true"
          width="100%"
          height="32"
          viewBox="0 0 200 32"
          preserveAspectRatio="none"
          fill="none"
        >
          <polyline
            className="draw stroke-primary"
            points="0,28 25,24 50,26 75,19 100,21 125,13 150,14 175,7 200,3"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </Card>
      <Card className="gap-2">
        <Label>{v.active.label}</Label>
        <Metric>{v.active.value}</Metric>
        <p className="text-[13px] text-muted-foreground">
          <span aria-hidden="true" className="text-success">
            ↑
          </span>{" "}
          {v.active.trend}
        </p>
      </Card>
      <Card className="gap-2">
        <Label>{v.churn.label}</Label>
        <Metric>{v.churn.value}</Metric>
        <span className="self-start">
          <StatusTag tone="terracotta">{v.churn.tag}</StatusTag>
        </span>
      </Card>
      <Card className="gap-2">
        <Label>{v.emails.label}</Label>
        <Metric>{v.emails.value}</Metric>
        <SoftTag>{v.emails.tag}</SoftTag>
      </Card>
      <div className="col-span-full flex flex-wrap items-center justify-between gap-3 rounded-xl bg-foreground px-5 py-4 text-sm leading-normal text-white">
        <p>{v.assistantMessage}</p>
        <ActionPill>{v.assistantAction}</ActionPill>
      </div>
    </div>
  );
}

function Operations() {
  const v = preview.operations;
  return (
    <div className="stagger flex flex-wrap gap-3">
      <Card className="flex-[2_1_380px] gap-3">
        <Label>{v.planningTitle}</Label>
        <div className="grid grid-cols-5 gap-1.5 text-xs">
          {v.days.map((day) => (
            <span key={day} className="text-muted-foreground">
              {day}
            </span>
          ))}
          {v.slots.flatMap((row, r) =>
            row.map((slot, d) =>
              slot ? (
                <span
                  key={`${r}-${d}`}
                  className="truncate rounded-lg border border-border bg-background px-1.5 py-2"
                >
                  {slot}
                </span>
              ) : (
                <span
                  key={`${r}-${d}`}
                  className="rounded-lg border border-dashed border-terracotta px-1.5 py-2"
                >
                  {v.replaceCoach}
                </span>
              ),
            ),
          )}
        </div>
      </Card>
      <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-3">
        {[v.failedPayments, v.coachHours].map((card) => (
          <Card key={card.label} className="gap-1.5">
            <Label>{card.label}</Label>
            <Metric size="md">{card.value}</Metric>
            <p className="text-[13px] text-muted-foreground">{card.note}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Crm() {
  const v = preview.crm;
  return (
    <div className="stagger flex flex-col gap-3">
      <ul className="flex flex-wrap gap-2 text-[13px]">
        {v.filters.map((filter, i) => (
          <li
            key={filter}
            className={`rounded-lg px-2.5 py-1 tabular-nums ${i === 0 ? "bg-foreground text-white" : "border border-border"}`}
          >
            {filter}
          </li>
        ))}
      </ul>
      <div className="overflow-hidden rounded-xl border border-border text-sm">
        <table className="w-full table-fixed border-collapse text-left">
          <thead className="bg-background font-mono text-[11px] tracking-[0.04em] text-muted-foreground uppercase">
            <tr>
              {v.columns.map((column) => (
                <th key={column} scope="col" className="px-4 py-2.5 font-normal">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {v.rows.map((row) => (
              <tr key={row.name} className="border-t border-border">
                <td className="px-4 py-3">{row.name}</td>
                <td className="px-4 py-3">
                  <StatusTag tone={row.tone}>{row.status}</StatusTag>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{row.last}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Marketplace() {
  const v = preview.marketplace;
  return (
    <div className="stagger flex flex-wrap gap-3">
      <Card className="flex-[1.4_1_320px] gap-3 text-sm">
        <Label>{v.restockTitle}</Label>
        {v.restock.map((line) => (
          <div key={line.item} className="flex justify-between gap-3">
            <span>{line.item}</span>
            <span className="font-mono text-muted-foreground tabular-nums">× {line.quantity}</span>
          </div>
        ))}
        <span className="self-start rounded-lg bg-primary px-3 py-2 text-xs font-semibold tracking-[0.04em] text-primary-foreground uppercase">
          {v.reorder}
        </span>
      </Card>
      <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-3">
        <Card className="gap-1.5">
          <Label>{v.cleaning.label}</Label>
          <p className="text-[15px]">{v.cleaning.value}</p>
          <p className="text-[13px] text-muted-foreground">{v.cleaning.note}</p>
        </Card>
        <Card className="gap-1.5">
          <Label>{v.merch.label}</Label>
          <p className="text-[15px]">{v.merch.value}</p>
          <SoftTag>{v.merch.tag}</SoftTag>
        </Card>
      </div>
    </div>
  );
}

function Integrations() {
  const v = preview.integrations;
  return (
    <ul className="stagger grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3">
      {v.tools.map((tool) => (
        <li
          key={tool.name}
          className="flex flex-col gap-2.5 rounded-xl border border-border px-4 py-3 sm:py-4"
        >
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-background font-mono text-[13px] font-semibold"
            >
              {tool.initials}
            </span>
            <span className="flex-1 text-[15px] font-semibold">{tool.name}</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
              {v.status}
            </span>
          </div>
          <p className="hidden text-[13px] leading-[1.45] text-muted-foreground sm:block">
            {tool.description}
          </p>
        </li>
      ))}
    </ul>
  );
}

const VIEWS: Record<StepId, () => React.ReactNode> = {
  quotidien: Quotidien,
  dashboard: Dashboard,
  operations: Operations,
  crm: Crm,
  marketplace: Marketplace,
  integrations: Integrations,
};

/** Une vue complète : titre, sous-titre, puis son contenu. */
export function PreviewPanel({ step }: { step: Step }) {
  const View = VIEWS[step.id];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xl font-semibold tracking-[-0.01em]">{step.label}</h3>
        <p className="text-sm text-muted-foreground">{step.subtitle}</p>
      </div>
      <View />
    </div>
  );
}
