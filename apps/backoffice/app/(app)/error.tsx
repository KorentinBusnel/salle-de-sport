"use client";

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

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon />
        </EmptyMedia>
        <EmptyTitle>{t("errors.errorTitle")}</EmptyTitle>
        <EmptyDescription>{t("errors.errorBody")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={reset}>{t("errors.retry")}</Button>
      </EmptyContent>
    </Empty>
  );
}
