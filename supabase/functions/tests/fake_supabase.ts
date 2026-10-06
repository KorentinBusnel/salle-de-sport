/**
 * Faux client Supabase des tests : enregistre les appels (rpc, update) et répond par des données
 * préparées, par table ou par fonction. Les requêtes chaînées renvoient la même promesse.
 */
type Result = { data: unknown; error: { message: string } | null };

export type Calls = {
  rpc: { fn: string; args: unknown }[];
  updates: { table: string; values: unknown }[];
};

export function fakeSupabase(options: {
  userId?: string | null;
  rpc?: Record<string, Result>;
  tables?: Record<string, unknown>;
}) {
  const calls: Calls = { rpc: [], updates: [] };
  const query = (table: string) => {
    const result: Result = { data: options.tables?.[table] ?? null, error: null };
    const builder: Record<string, unknown> = {};
    for (const name of ["select", "eq", "in", "not", "limit", "order", "is"]) {
      builder[name] = () => builder;
    }
    builder.maybeSingle = () => Promise.resolve(result);
    builder.single = () => Promise.resolve(result);
    builder.update = (values: unknown) => {
      calls.updates.push({ table, values });
      return builder;
    };
    builder.then = (resolve: (r: Result) => unknown) => Promise.resolve(result).then(resolve);
    return builder;
  };
  const client = {
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: options.userId ? { id: options.userId } : null } }),
    },
    rpc: (fn: string, args: unknown) => {
      calls.rpc.push({ fn, args });
      return Promise.resolve(options.rpc?.[fn] ?? { data: null, error: null });
    },
    from: query,
  };
  // deno-lint-ignore no-explicit-any
  return { client: client as any, calls };
}
