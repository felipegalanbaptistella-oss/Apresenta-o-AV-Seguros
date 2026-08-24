import { drizzle, type AnyD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

let d1Binding: AnyD1Database | undefined;

export function configureD1(binding: AnyD1Database | undefined) {
  d1Binding = binding;
}

export function getDb() {
  return drizzle(getD1(), { schema });
}

export function getD1(): AnyD1Database {
  if (!d1Binding) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return d1Binding;
}
