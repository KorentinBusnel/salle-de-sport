import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Database } from "@salle/supabase";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/** Client Supabase de l'app : session persistée sur l'appareil, lectures filtrées par la RLS. */
export const supabase = createClient<Database>(
  env.EXPO_PUBLIC_SUPABASE_URL,
  env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
