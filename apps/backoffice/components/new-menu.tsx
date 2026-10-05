import {
  CalendarPlusIcon,
  ChevronDownIcon,
  MailPlusIcon,
  PlusIcon,
  UserPlusIcon,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { t } from "@/lib/i18n";

const ICONS = { member: UserPlusIcon, session: CalendarPlusIcon, campaign: MailPlusIcon };
export type NewMenuItem = { kind: keyof typeof ICONS; href: string };

/** « + Nouveau » : création rapide, selon le rôle (adhérent, séance, campagne). */
export function NewMenu({ items }: { items: NewMenuItem[] }) {
  if (items.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="shrink-0">
          <PlusIcon data-icon="inline-start" />
          <span className="hidden sm:inline">{t("topbar.new")}</span>
          <ChevronDownIcon className="hidden sm:block" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {items.map((item) => {
          const Icon = ICONS[item.kind];
          return (
            <DropdownMenuItem key={item.kind} asChild>
              <Link href={item.href}>
                <Icon />
                {t(`topbar.newItem.${item.kind}`)}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
