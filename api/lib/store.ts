import { promises as fs } from "fs";
import path from "path";

export interface StoredMessage {
  id: string;
  text: string;
  category?: string;
  createdAt: string; // server-generated timestamp (technical only)
}

export interface MessageStore {
  save(message: Omit<StoredMessage, "id" | "createdAt">): Promise<StoredMessage>;
}

/**
 * Default store: appends messages to a local JSON file. This works out of
 * the box with zero configuration, which is fine for testing but is NOT
 * durable on most serverless hosts (the filesystem can reset on redeploy).
 * Swap this out for a real database before going live — see the Supabase
 * example below and the README's "Collegare un database" section.
 */
class JsonFileStore implements MessageStore {
  private filePath = path.join(process.cwd(), "api", "data", "messages.json");

  private async readAll(): Promise<StoredMessage[]> {
    try {
      const raw = await fs.readFile(this.filePath, "utf-8");
      return JSON.parse(raw) as StoredMessage[];
    } catch {
      return [];
    }
  }

  async save(message: Omit<StoredMessage, "id" | "createdAt">): Promise<StoredMessage> {
    const all = await this.readAll();
    const entry: StoredMessage = {
      id: cryptoRandomId(),
      createdAt: new Date().toISOString(),
      ...message,
    };
    all.push(entry);
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(all, null, 2), "utf-8");
    return entry;
  }
}

function cryptoRandomId(): string {
  // Lightweight, dependency-free id — good enough for a message key.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/*
 * ---------------------------------------------------------------------
 * SUPABASE EXAMPLE (commented out) — see README "Collegare un database"
 * ---------------------------------------------------------------------
 *
 * import { createClient } from "@supabase/supabase-js";
 *
 * const supabase = createClient(
 *   process.env.SUPABASE_URL!,
 *   process.env.SUPABASE_SERVICE_ROLE_KEY! // server-side only, never expose to the client
 * );
 *
 * class SupabaseStore implements MessageStore {
 *   async save(message: Omit<StoredMessage, "id" | "createdAt">) {
 *     const { data, error } = await supabase
 *       .from("messages")
 *       .insert({ text: message.text, category: message.category ?? null })
 *       .select()
 *       .single();
 *     if (error) throw error;
 *     return { id: data.id, createdAt: data.created_at, ...message };
 *   }
 * }
 *
 * Suggested table:
 *   create table messages (
 *     id uuid primary key default gen_random_uuid(),
 *     text text not null,
 *     category text,
 *     created_at timestamptz not null default now()
 *   );
 *
 * Then in getStore(), return `new SupabaseStore()` when SUPABASE_URL is set.
 */

let store: MessageStore | null = null;

export function getStore(): MessageStore {
  if (!store) {
    store = new JsonFileStore();
  }
  return store;
}
