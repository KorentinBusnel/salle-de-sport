import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { initials } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Coachs d'une séance en avatars superposés (Watermelon avatar-13/18), le principal en premier,
 * « +N » au-delà de `max`. Le nom complet reste lisible (liste pour les lecteurs d'écran,
 * infobulle au survol ou au focus).
 */
export function CoachStack({
  names,
  max = 3,
  size = "sm",
  className,
}: {
  names: string[];
  max?: number | undefined;
  size?: "sm" | "default" | undefined;
  className?: string | undefined;
}) {
  if (!names.length) return null;
  const shown = names.slice(0, max);
  const rest = names.slice(max);
  const avatarClass = cn("ring-2 ring-card", size === "sm" ? "size-6" : "size-8");
  const textClass = size === "sm" ? "text-[0.6rem]" : "text-xs";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            "inline-flex items-center -space-x-1.5 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            className,
          )}
        >
          <span className="sr-only">{names.join(", ")}</span>
          {shown.map((name) => (
            <Avatar key={name} aria-hidden className={avatarClass}>
              <AvatarFallback className={cn("bg-accent text-accent-foreground", textClass)}>
                {initials(name)}
              </AvatarFallback>
            </Avatar>
          ))}
          {rest.length ? (
            <Avatar aria-hidden className={avatarClass}>
              <AvatarFallback className={cn("tabular-nums", textClass)}>
                {t("forms.more", { count: rest.length })}
              </AvatarFallback>
            </Avatar>
          ) : null}
        </span>
      </TooltipTrigger>
      <TooltipContent>{names.join(", ")}</TooltipContent>
    </Tooltip>
  );
}
