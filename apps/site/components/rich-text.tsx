import {
  ArrowsClockwiseIcon,
  BandaidsIcon,
  BankIcon,
  CalendarCheckIcon,
  ChartLineUpIcon,
  CheckCircleIcon,
  ClockIcon,
  CoinsIcon,
  CreditCardIcon,
  EnvelopeSimpleIcon,
  HandCoinsIcon,
  ListChecksIcon,
  SlidersHorizontalIcon,
  TargetIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import { Fragment } from "react";
import { type KeywordIconName, parseRichText } from "@/lib/rich-text";

const KEYWORD_ICONS: Record<KeywordIconName, Icon> = {
  calendar: CalendarCheckIcon,
  coins: CoinsIcon,
  chart: ChartLineUpIcon,
  users: UsersThreeIcon,
  mail: EnvelopeSimpleIcon,
  slots: ClockIcon,
  waitlist: ListChecksIcon,
  target: TargetIcon,
  injury: BandaidsIcon,
  presence: CheckCircleIcon,
  card: CreditCardIcon,
  debit: ArrowsClockwiseIcon,
  accounting: BankIcon,
  rules: SlidersHorizontalIcon,
  pay: HandCoinsIcon,
};

/**
 * Pastille d'un mot clé dans une phrase : fond carte, ombre du design system, icône au trait
 * dans un rond orange clair, mot en couleur du texte. Jamais coupée ; l'icône est décorative.
 */
function Keyword({ icon, children }: { icon: KeywordIconName; children: string }) {
  const Glyph = KEYWORD_ICONS[icon];
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-card py-0.5 pr-3 pl-0.5 align-middle font-medium text-foreground shadow-border">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
        <Glyph aria-hidden="true" className="size-4" />
      </span>
      {children}
    </span>
  );
}

/**
 * Phrase du catalogue avec `[mot](icône)` et `**gras**` (lib/rich-text.ts). Le paragraphe qui
 * l'accueille prend un interligne de 36 px (`leading-9`) pour que les pastilles respirent.
 */
export function RichText({ text }: { text: string }) {
  return parseRichText(text).map((segment, index) => {
    if (segment.kind === "text") return <Fragment key={index}>{segment.text}</Fragment>;
    if (segment.kind === "strong") {
      return (
        <strong key={index} className="font-medium text-foreground">
          {segment.text}
        </strong>
      );
    }
    return (
      <span key={index} className="whitespace-nowrap">
        <Keyword icon={segment.icon}>{segment.text}</Keyword>
        {segment.after}
      </span>
    );
  });
}
