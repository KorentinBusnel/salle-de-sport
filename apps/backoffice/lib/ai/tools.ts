import type { TypedSupabaseClient } from "@salle/supabase";
import {
  monthRange,
  parseSegmentFilters,
  segmentFiltersSchema,
  zonedStartOfDateKey,
} from "@salle/shared";
import { z } from "zod";
import { type AgentTool, defineTool } from "@/lib/ai/agent";
import type { Proposal } from "@/lib/ai/types";
import { t } from "@/lib/i18n";

/** Contexte des outils : client Supabase de l'utilisateur (RLS) et salle courante. */
export type ToolContext = {
  supabase: TypedSupabaseClient;
  gymId: string;
  timezone: string;
  /** Date du jour « AAAA-MM-JJ » dans le fuseau de la salle. */
  today: string;
};

const date = z.iso.date().describe("Date AAAA-MM-JJ (fuseau de la salle)");
const memberStatus = z.enum(["prospect", "active", "suspended", "cancelled"]);

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

const shiftDay = (key: string, days: number) =>
  new Date(Date.parse(`${key}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/**
 * Outils de l'assistant (BRIEF §7.2) : lectures par fonctions SQL sous la RLS de l'utilisateur,
 * jamais de SQL libre ; les actions sortantes ne sont que des propositions à valider.
 */
export const assistantTools: AgentTool<ToolContext>[] = [
  defineTool({
    name: "search_members",
    description:
      "Recherche des adhérents par nom, email ou téléphone, statut ou tag. Renvoie identifiant, nom, statut et tags (coordonnées seulement si include_contact).",
    schema: z.object({
      query: z.string().max(80).optional(),
      status: memberStatus.optional(),
      tag: z.string().max(40).optional(),
      include_contact: z.boolean().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    step: t("assistant.steps.members"),
    async run(ctx, input) {
      const { data, error } = await ctx.supabase.rpc("search_members", {
        p_gym_id: ctx.gymId,
        ...(input.query ? { p_query: input.query } : {}),
        ...(input.status ? { p_statuses: [input.status] } : {}),
        ...(input.tag ? { p_tag: input.tag } : {}),
        p_limit: input.limit ?? 20,
      });
      fail(error);
      return {
        total: data?.[0]?.total_count ?? 0,
        members: (data ?? []).map((m) => ({
          id: m.id,
          name: `${m.first_name} ${m.last_name}`,
          status: m.status,
          tags: m.tags,
          ...(input.include_contact ? { email: m.email, phone: m.phone } : {}),
        })),
      };
    },
  }),

  defineTool({
    name: "get_member_timeline",
    description:
      "Fiche d'un adhérent : statut, ancienneté, tags, consentements, solde de crédits, dernières réservations et derniers échanges (notes, messages).",
    schema: z.object({ member_id: z.guid() }),
    step: t("assistant.steps.timeline"),
    async run(ctx, input) {
      const [member, bookings, interactions, ledger] = await Promise.all([
        ctx.supabase
          .from("members")
          .select(
            "id, first_name, last_name, status, tags, created_at, marketing_email_consent_at, acquisition_source",
          )
          .eq("id", input.member_id)
          .eq("gym_id", ctx.gymId)
          .maybeSingle(),
        ctx.supabase
          .from("bookings")
          .select("status, class_sessions(starts_at, disciplines(name))")
          .eq("member_id", input.member_id)
          .order("booked_at", { ascending: false })
          .limit(20),
        ctx.supabase
          .from("interactions")
          .select("occurred_at, channel, direction, subject, summary")
          .eq("member_id", input.member_id)
          .order("occurred_at", { ascending: false })
          .limit(15),
        ctx.supabase.from("credit_ledger").select("delta").eq("member_id", input.member_id),
      ]);
      fail(member.error);
      if (!member.data) throw new Error("Adhérent introuvable dans cette salle.");
      return {
        member: {
          ...member.data,
          name: `${member.data.first_name} ${member.data.last_name}`,
          email_consent: member.data.marketing_email_consent_at !== null,
          credits: (ledger.data ?? []).reduce((sum, row) => sum + row.delta, 0),
        },
        bookings: (bookings.data ?? []).map((b) => ({
          status: b.status,
          starts_at: b.class_sessions?.starts_at,
          discipline: b.class_sessions?.disciplines?.name,
        })),
        interactions: (interactions.data ?? []).map((i) => ({
          ...i,
          summary: i.summary?.slice(0, 200) ?? null,
        })),
      };
    },
  }),

  defineTool({
    name: "get_kpis",
    description:
      "Indicateurs de la salle sur une période : nouvelles fiches, remplissage (global, par discipline, par créneau), présences, adhérents en baisse de fréquence, heures et coût des coachs.",
    schema: z.object({ from: date, to: date }),
    step: t("assistant.steps.kpis"),
    async run(ctx, input) {
      const { data, error } = await ctx.supabase.rpc("gym_kpis", {
        p_gym_id: ctx.gymId,
        p_from: input.from,
        p_to: input.to,
      });
      fail(error);
      return data;
    },
  }),

  defineTool({
    name: "get_session_stats",
    description:
      "Statistiques des séances passées d'une période, filtrables par discipline (nom) et heure de début locale (« 18:30 ») : places, inscrits, présents, absents (no-shows), liste d'attente. Renvoie un total et le détail.",
    schema: z.object({
      from: date,
      to: date,
      discipline: z.string().max(60).optional(),
      start_time: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .optional(),
    }),
    step: t("assistant.steps.sessions"),
    async run(ctx, input) {
      let disciplineId: string | undefined;
      if (input.discipline) {
        const { data } = await ctx.supabase
          .from("disciplines")
          .select("id, name")
          .eq("gym_id", ctx.gymId)
          .ilike("name", input.discipline)
          .limit(1)
          .maybeSingle();
        if (!data) throw new Error(`Discipline « ${input.discipline} » inconnue.`);
        disciplineId = data.id;
      }
      const { data, error } = await ctx.supabase.rpc("session_stats", {
        p_gym_id: ctx.gymId,
        p_from: input.from,
        p_to: input.to,
        ...(disciplineId ? { p_discipline_id: disciplineId } : {}),
        ...(input.start_time ? { p_local_time: input.start_time } : {}),
      });
      fail(error);
      const rows = (data ?? []).filter(
        (r) => !r.cancelled && Date.parse(r.starts_at) <= Date.now(),
      );
      const sum = (key: "booked" | "attended" | "no_show" | "capacity") =>
        rows.reduce((total, r) => total + r[key], 0);
      return {
        sessions: rows.length,
        capacity: sum("capacity"),
        booked: sum("booked"),
        attended: sum("attended"),
        no_show: sum("no_show"),
        cancelled_sessions: (data ?? []).filter((r) => r.cancelled).length,
        detail: rows.slice(0, 40).map((r) => ({
          id: r.session_id,
          starts_at: r.starts_at,
          discipline: r.discipline,
          coaches: r.coaches,
          booked: r.booked,
          capacity: r.capacity,
          attended: r.attended,
          no_show: r.no_show,
        })),
      };
    },
  }),

  defineTool({
    name: "get_churn_list",
    description:
      "Adhérents à risque : actifs sans séance depuis N jours (défaut 21) et adhérents dont la fréquence a baissé de moitié sur 30 jours.",
    schema: z.object({ inactive_days: z.number().int().min(1).max(365).optional() }),
    step: t("assistant.steps.churn"),
    async run(ctx, input) {
      const days = input.inactive_days ?? 21;
      const [inactive, kpis] = await Promise.all([
        ctx.supabase
          .rpc("filter_members", {
            p_gym_id: ctx.gymId,
            p_filters: { statuses: ["active"], inactive_days: days },
          })
          .select("id, first_name, last_name, marketing_email_consent_at")
          .limit(60),
        ctx.supabase.rpc("gym_kpis", {
          p_gym_id: ctx.gymId,
          p_from: shiftDay(ctx.today, -59),
          p_to: ctx.today,
        }),
      ]);
      fail(inactive.error);
      return {
        inactive_days: days,
        inactive: (inactive.data ?? []).map((m) => ({
          id: m.id,
          name: `${m.first_name} ${m.last_name}`,
          email_consent: m.marketing_email_consent_at !== null,
        })),
        declining: (kpis.data as { at_risk?: unknown[] } | null)?.at_risk ?? [],
      };
    },
  }),

  defineTool({
    name: "list_sessions",
    description:
      "Séances (passées ou à venir) à partir d'une date sur 1 à 7 jours : horaire, discipline, coachs, inscrits / places, liste d'attente, statut.",
    schema: z.object({ date, days: z.number().int().min(1).max(7).optional() }),
    step: t("assistant.steps.planning"),
    async run(ctx, input) {
      const from = zonedStartOfDateKey(input.date, ctx.timezone);
      const to = zonedStartOfDateKey(shiftDay(input.date, input.days ?? 1), ctx.timezone);
      const { data, error } = await ctx.supabase
        .from("class_sessions")
        .select(
          "id, starts_at, ends_at, status, capacity, booked_count, waitlist_count, disciplines(name), session_coaches(position, coaches(display_name))",
        )
        .eq("gym_id", ctx.gymId)
        .gte("starts_at", from.toISOString())
        .lt("starts_at", to.toISOString())
        .order("starts_at");
      fail(error);
      return (data ?? []).map((s) => ({
        id: s.id,
        starts_at: s.starts_at,
        ends_at: s.ends_at,
        status: s.status,
        discipline: s.disciplines?.name,
        coaches: [...s.session_coaches]
          .sort((a, b) => a.position - b.position)
          .map((c) => c.coaches?.display_name),
        booked: s.booked_count,
        capacity: s.capacity,
        waitlist: s.waitlist_count,
      }));
    },
  }),

  defineTool({
    name: "get_coach_hours",
    description:
      "Heures réalisées par coach sur un mois (séances, minutes, taux, montant en centimes).",
    schema: z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }),
    step: t("assistant.steps.coaches"),
    async run(ctx, input) {
      const range = monthRange(input.month);
      if (!range) throw new Error("Mois invalide.");
      const { data, error } = await ctx.supabase.rpc("coach_hours", {
        p_gym_id: ctx.gymId,
        p_from: range.from,
        p_to: range.to,
      });
      fail(error);
      return data;
    },
  }),

  defineTool({
    name: "count_segment",
    description:
      "Compte les adhérents correspondant à des filtres de segment (statuses, tags, inactive_days, discipline_id, max_credits, joined_since, birthday_month, email_consent) et donne un échantillon.",
    schema: z.object({ filters: segmentFiltersSchema }),
    step: t("assistant.steps.segment"),
    async run(ctx, input) {
      const { data, error, count } = await ctx.supabase
        .rpc(
          "filter_members",
          { p_gym_id: ctx.gymId, p_filters: input.filters },
          { count: "exact" },
        )
        .select("id, first_name, last_name")
        .limit(10);
      fail(error);
      return {
        count: count ?? 0,
        sample: (data ?? []).map((m) => ({ id: m.id, name: `${m.first_name} ${m.last_name}` })),
      };
    },
  }),

  defineTool({
    name: "get_today_board",
    description:
      "Journée d'une date (aujourd'hui par défaut) : essais et nouveaux venus (1re ou 2e séance) par séance, et permanences à l'accueil. N'expose jamais le contenu des notes « à savoir », seulement leur présence.",
    schema: z.object({ date: date.optional() }),
    step: t("assistant.steps.today"),
    async run(ctx, input) {
      const day = input.date ?? ctx.today;
      const start = zonedStartOfDateKey(day, ctx.timezone);
      const end = zonedStartOfDateKey(shiftDay(day, 1), ctx.timezone);
      const [trials, shifts] = await Promise.all([
        ctx.supabase.rpc("today_trials", { p_gym_id: ctx.gymId, p_day: day }),
        ctx.supabase
          .from("desk_shifts")
          .select("starts_at, ends_at, profiles!desk_shifts_profile_id_fkey(first_name, last_name)")
          .eq("gym_id", ctx.gymId)
          .lt("starts_at", end.toISOString())
          .gt("ends_at", start.toISOString())
          .order("starts_at"),
      ]);
      fail(trials.error);
      fail(shifts.error);
      return {
        date: day,
        newcomers: (trials.data ?? []).map((row) => ({
          session_id: row.session_id,
          starts_at: row.starts_at,
          discipline: row.discipline,
          coaches: row.coaches,
          member_id: row.member_id,
          name: `${row.first_name} ${row.last_name}`,
          trial: row.is_trial,
          visit: row.visit_number,
          has_note: row.note !== null,
        })),
        desk_shifts: (shifts.data ?? []).map((row) => ({
          starts_at: row.starts_at,
          ends_at: row.ends_at,
          who: row.profiles
            ? `${row.profiles.first_name ?? ""} ${row.profiles.last_name ?? ""}`.trim()
            : null,
        })),
      };
    },
  }),

  defineTool({
    name: "get_crm_todo",
    description:
      "CRM à compléter : fiches sans email ou téléphone, adhérents dont le dernier message est resté sans réponse, prospects venus ces 7 derniers jours à rappeler. Totaux et 10 premiers noms.",
    schema: z.object({}),
    step: t("assistant.steps.crm"),
    async run(ctx) {
      const { data, error } = await ctx.supabase.rpc("crm_todo", { p_gym_id: ctx.gymId });
      fail(error);
      const ids = [...new Set((data ?? []).flatMap((row) => row.member_ids.slice(0, 10)))];
      const { data: members, error: membersError } = ids.length
        ? await ctx.supabase.from("members").select("id, first_name, last_name").in("id", ids)
        : { data: [], error: null };
      fail(membersError);
      const names = new Map((members ?? []).map((m) => [m.id, `${m.first_name} ${m.last_name}`]));
      return Object.fromEntries(
        (data ?? []).map((row) => [
          row.kind,
          {
            total: row.total,
            members: row.member_ids.slice(0, 10).map((id) => ({ id, name: names.get(id) ?? null })),
          },
        ]),
      );
    },
  }),

  defineTool({
    name: "get_unpaid",
    description:
      "Impayés clients : adhérents avec des prélèvements échoués depuis leur dernier paiement réussi ou un abonnement en retard. Montant, nombre d'échecs, date du premier échec.",
    schema: z.object({}),
    step: t("assistant.steps.unpaid"),
    async run(ctx) {
      const { data, error } = await ctx.supabase.rpc("unpaid_members", { p_gym_id: ctx.gymId });
      fail(error);
      return (data ?? []).map((row) => ({
        member_id: row.member_id,
        name: `${row.first_name} ${row.last_name}`,
        plan: row.plan,
        amount_eur: row.amount_cents / 100,
        failures: row.failures,
        first_failed_at: row.first_failed_at,
      }));
    },
  }),

  defineTool({
    name: "propose_message",
    description:
      "Prépare un message (relance, information) à des adhérents précis, affiché au gérant pour validation. N'envoie rien. Variables possibles : {prenom}, {nom}, {salle}.",
    schema: z.object({
      member_ids: z.array(z.guid()).min(1).max(50),
      subject: z.string().trim().min(1).max(200),
      body: z.string().trim().min(1).max(4000),
    }),
    step: t("assistant.steps.proposal"),
    proposes: true,
    async run(ctx, input): Promise<Proposal> {
      const { data, error } = await ctx.supabase
        .from("members")
        .select("id, first_name, last_name")
        .eq("gym_id", ctx.gymId)
        .in("id", input.member_ids);
      fail(error);
      if (!data?.length) throw new Error("Aucun destinataire trouvé dans cette salle.");
      return {
        type: "message",
        id: crypto.randomUUID(),
        members: data.map((m) => ({ id: m.id, name: `${m.first_name} ${m.last_name}` })),
        subject: input.subject,
        body: input.body,
      };
    },
  }),

  defineTool({
    name: "propose_segment",
    description: "Prépare la création d'un segment enregistré, affichée au gérant pour validation.",
    schema: z.object({ name: z.string().trim().min(1).max(80), filters: segmentFiltersSchema }),
    step: t("assistant.steps.proposal"),
    proposes: true,
    async run(ctx, input): Promise<Proposal> {
      const filters = parseSegmentFilters(input.filters);
      const { count } = await ctx.supabase.rpc(
        "filter_members",
        { p_gym_id: ctx.gymId, p_filters: filters },
        { count: "exact", head: true },
      );
      return {
        type: "segment",
        id: crypto.randomUUID(),
        name: input.name,
        filters,
        count: count ?? 0,
      };
    },
  }),
];

/** Consigne système : rôle, salle, date, règles de réponse et de sécurité. */
export function systemPrompt(gymName: string, today: string, timezone: string, extra?: string) {
  return [
    `Tu es l'assistant du back office de la salle de sport « ${gymName} ». Tu réponds au gérant en français, de façon concise et chiffrée.`,
    `Aujourd'hui : ${today} (fuseau ${timezone}). Les semaines vont du lundi au dimanche.`,
    "Utilise les outils pour toute donnée : n'invente jamais un chiffre, un nom ni une date. Si un outil ne couvre pas la question, dis-le.",
    "Finances : seuls les impayés clients sont disponibles (get_unpaid). Chiffre d'affaires, trésorerie et factures fournisseurs attendent Stripe, Qonto et Pennylane : dis-le si on te les demande.",
    "Liens internes en Markdown : adhérent [Prénom Nom](/adherents/<id>), séance [CrossFit du 12/10 18h30](/planning/<id>), pages /indicateurs, /segments, /messages.",
    "Tu ne peux rien envoyer ni modifier toi-même : pour un message ou un segment, utilise propose_message ou propose_segment ; le gérant valide dans l'interface.",
    "Ne cite téléphone ou email que si on te les demande. Mise en forme : phrases courtes, listes à puces, gras pour les chiffres clés.",
    ...(extra ? [extra] : []),
  ].join("\n");
}
