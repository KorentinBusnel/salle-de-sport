import { TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** État d'erreur avec « Réessayer » : page entière (error.tsx) ou section (SectionError). */
export function ErrorState({
  retry,
  compact = false,
}: {
  retry: () => void;
  compact?: boolean | undefined;
}) {
  return (
    <Empty className={cn(compact && "gap-3 rounded-xl border border-dashed p-6 md:p-6")}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{t(compact ? "errors.sectionTitle" : "errors.errorTitle")}</EmptyTitle>
        <EmptyDescription>
          {t(compact ? "errors.sectionBody" : "errors.errorBody")}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant={compact ? "outline" : "default"} onClick={() => retry()}>
          {t("errors.retry")}
        </Button>
      </EmptyContent>
    </Empty>
  );
}
