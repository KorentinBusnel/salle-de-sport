"use client";

import { catchError, type ErrorInfo } from "next/error";
import { ErrorState } from "@/components/error-state";

/**
 * Limite d'erreur d'une section chargée à part (sous Suspense) : la section affiche « Réessayer »,
 * le reste de la page reste utilisable.
 */
export const SectionError = catchError((_props: object, { retry }: ErrorInfo) => (
  <ErrorState retry={retry} compact />
));
