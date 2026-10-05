import "server-only";
import {
  type GymPrivateSettings,
  type GymSettings,
  type OpeningHours,
  parseGymPrivateSettings,
  parseGymSettings,
  parseOpeningHours,
} from "@salle/shared";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type GymIdentity = {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logoPath: string | null;
  /** URL publique du logo (bucket gym-assets), null sans logo. */
  logoUrl: string | null;
  timezone: string;
};

export type GymConfig = {
  identity: GymIdentity;
  /** Règles et stratégies (gyms.settings, lues aussi par les fonctions SQL). */
  settings: GymSettings;
  /** Réglages internes (gym_private_settings, équipe seulement). */
  private: GymPrivateSettings;
  openingHours: OpeningHours;
};

/** Configuration de la salle, mémorisée pour la durée de la requête (deux lectures). */
export const getGymConfig = cache(async (gymId: string): Promise<GymConfig> => {
  const supabase = await createClient();
  const [{ data: gym }, { data: internal }] = await Promise.all([
    supabase
      .from("gyms")
      .select("name, address, phone, email, logo_path, timezone, opening_hours, settings")
      .eq("id", gymId)
      .single(),
    supabase.from("gym_private_settings").select("settings").eq("gym_id", gymId).maybeSingle(),
  ]);
  const logoPath = gym?.logo_path ?? null;
  return {
    identity: {
      name: gym?.name ?? "",
      address: gym?.address ?? null,
      phone: gym?.phone ?? null,
      email: gym?.email ?? null,
      logoPath,
      logoUrl: logoPath
        ? supabase.storage.from("gym-assets").getPublicUrl(logoPath).data.publicUrl
        : null,
      timezone: gym?.timezone ?? "Europe/Paris",
    },
    settings: parseGymSettings(gym?.settings),
    private: parseGymPrivateSettings(internal?.settings),
    openingHours: parseOpeningHours(gym?.opening_hours),
  };
});

/** Réglages et stratégies de la salle (gyms.settings). */
export const getGymSettings = cache(
  async (gymId: string): Promise<GymSettings> => (await getGymConfig(gymId)).settings,
);
