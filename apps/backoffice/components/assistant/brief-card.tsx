"use client";

import { RefreshCwIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { generateBrief } from "@/app/(app)/hub/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { t } from "@/lib/i18n";

/** Brief de la semaine : généré à la demande par l'assistant, enregistré pour la semaine. */
export function BriefCard({
  content,
  generatedAt,
  configured,
}: {
  content: string | null;
  generatedAt: string | null;
  configured: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const generate = () =>
    startTransition(async () => {
      const result = await generateBrief();
      if (result.error) toast.error(t(result.error), { closeButton: true });
    });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle className="flex items-center gap-2">
            <SparklesIcon className="size-4 text-primary" aria-hidden />
            {t("hub.brief")}
          </CardTitle>
          {generatedAt ? <CardDescription>{generatedAt}</CardDescription> : null}
        </div>
        {configured && content ? (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={generate}
            disabled={pending}
            aria-label={t("hub.regenerate")}
          >
            <RefreshCwIcon className={pending ? "animate-spin" : undefined} />
          </Button>
        ) : null}
      </CardHeader>
      <CardContent aria-busy={pending}>
        {content ? (
          <div className="prose-assistant text-sm leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }) =>
                  href?.startsWith("/") ? (
                    <Link href={href} className="font-medium text-primary hover:underline">
                      {children}
                    </Link>
                  ) : (
                    <span>{children}</span>
                  ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        ) : configured ? (
          <div className="grid gap-3 text-sm text-muted-foreground">
            <p>{t("hub.briefEmpty")}</p>
            <Button onClick={generate} disabled={pending} className="w-fit" aria-busy={pending}>
              {pending ? <RefreshCwIcon className="animate-spin" data-icon="inline-start" /> : null}
              {t("hub.generate")}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("assistant.notConfigured")}</p>
        )}
      </CardContent>
    </Card>
  );
}
