import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { getRealmClient } from "./realmClients";

type ClientKey = keyof SupabaseClient<Database>;

export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop: ClientKey) {
    const client = getRealmClient();
    const value = client[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});