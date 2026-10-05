"use client";

import {
  CalendarDaysIcon,
  ChartColumnIcon,
  ChevronsUpDownIcon,
  ClockIcon,
  DumbbellIcon,
  FilterIcon,
  KanbanIcon,
  HouseIcon,
  LogOutIcon,
  MailPlusIcon,
  MailIcon,
  RepeatIcon,
  SettingsIcon,
  SparklesIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { initials } from "@/lib/format";
import { t } from "@/lib/i18n";

const ICONS = {
  today: HouseIcon,
  planning: CalendarDaysIcon,
  templates: RepeatIcon,
  members: UsersIcon,
  messages: MailIcon,
  coaches: DumbbellIcon,
  hours: ClockIcon,
  crm: KanbanIcon,
  segments: FilterIcon,
  emailing: MailPlusIcon,
  kpis: ChartColumnIcon,
  hub: SparklesIcon,
  settings: SettingsIcon,
} satisfies Record<string, LucideIcon>;

export type NavIcon = keyof typeof ICONS;
export type NavItem = { href: string; label: string; icon: NavIcon; badge?: number };
export type NavGroup = { label: string; items: NavItem[] };

/** Entrée active : celle dont le chemin est le plus long préfixe (« Modèles » ≠ « Planning »). */
export function activeHref(pathname: string, hrefs: string[]): string | undefined {
  return hrefs
    .filter((href) =>
      href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`),
    )
    .sort((a, b) => b.length - a.length)[0];
}

export function AppSidebar({
  gymName,
  displayName,
  roleLabel,
  groups,
  footer,
  signOut,
}: {
  gymName: string;
  displayName: string;
  roleLabel: string;
  groups: NavGroup[];
  footer: NavItem[];
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const active = activeHref(pathname, [
    ...groups.flatMap((group) => group.items.map((item) => item.href)),
    ...footer.map((item) => item.href),
  ]);
  const close = () => isMobile && setOpenMobile(false);

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/" onClick={close}>
                <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                  {initials(gymName)}
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">{gymName}</span>
                  <span className="truncate text-xs text-muted-foreground">{t("app.title")}</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    active={item.href === active}
                    onNavigate={close}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        {/* Formulaire hors du menu : la fermeture du menu ne le démonte pas. */}
        <form id="signout" action={signOut} />
        {footer.length ? (
          <SidebarMenu className="border-t pt-2">
            {footer.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={item.href === active}
                onNavigate={close}
              />
            ))}
          </SidebarMenu>
        ) : null}
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-accent text-accent-foreground">
                      {initials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="grid flex-1 text-left leading-tight">
                    <span className="truncate font-medium">{displayName}</span>
                    <span className="truncate text-xs text-muted-foreground">{roleLabel}</span>
                  </span>
                  <ChevronsUpDownIcon className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={isMobile ? "bottom" : "right"}
                align="end"
                className="min-w-56"
              >
                <DropdownMenuLabel className="font-normal">
                  <span className="block truncate font-medium">{displayName}</span>
                  <span className="block truncate text-xs text-muted-foreground">{roleLabel}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" asChild>
                  <button type="submit" form="signout" className="w-full">
                    <LogOutIcon />
                    {t("nav.signOut")}
                  </button>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate: () => void;
}) {
  const Icon = ICONS[item.icon];
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.label}
        className="pointer-coarse:h-10"
      >
        <Link href={item.href} aria-current={active ? "page" : undefined} onClick={onNavigate}>
          <Icon />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
      {item.badge ? (
        <SidebarMenuBadge
          className="bg-primary text-primary-foreground tabular-nums peer-data-active/menu-button:text-primary-foreground"
          aria-label={t("nav.badge", { count: item.badge })}
        >
          {item.badge}
        </SidebarMenuBadge>
      ) : null}
    </SidebarMenuItem>
  );
}
