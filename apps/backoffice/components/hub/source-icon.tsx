import type { DigestSource } from "@salle/shared";
import {
  CalculatorIcon,
  CalendarDaysIcon,
  CreditCardIcon,
  KanbanIcon,
  LandmarkIcon,
  MailIcon,
  MessageCircleIcon,
  MessagesSquareIcon,
  type LucideIcon,
} from "lucide-react";

/** Icône générique d'une source (pas de logo de marque). */
export const SOURCE_ICON: Record<DigestSource, LucideIcon> = {
  bookings: CalendarDaysIcon,
  payments: CreditCardIcon,
  crm: KanbanIcon,
  messages: MessagesSquareIcon,
  gmail: MailIcon,
  whatsapp: MessageCircleIcon,
  qonto: LandmarkIcon,
  pennylane: CalculatorIcon,
};
