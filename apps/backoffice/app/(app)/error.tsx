"use client";

import { ErrorState } from "@/components/error-state";

export default function ErrorPage({ retry }: { error: Error; retry: () => void }) {
  return <ErrorState retry={retry} />;
}
