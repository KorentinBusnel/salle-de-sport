// Types générés depuis le schéma local : ne pas modifier database.types.ts à la main,
// le régénérer avec `pnpm db:types` après chaque migration.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types.ts";

export type {
  Database,
  Enums,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "./database.types.ts";
export { Constants } from "./database.types.ts";

/** Client Supabase typé sur le schéma de la plateforme. */
export type TypedSupabaseClient = SupabaseClient<Database>;
