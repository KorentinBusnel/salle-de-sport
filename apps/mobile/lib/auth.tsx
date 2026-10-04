import type { Session } from "@supabase/supabase-js";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type AuthState = { loading: boolean; session: Session | null };

const AuthContext = createContext<AuthState>({ loading: true, session: null });

/** Session Supabase de l'appareil, tenue à jour à chaque connexion / déconnexion. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ loading: true, session: null });

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setState({ loading: false, session: data.session }));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ loading: false, session });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
