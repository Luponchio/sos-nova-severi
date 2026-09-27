import { createClient } from "@supabase/supabase-js";

export interface StoredMessage {
  id: string;
  text: string;
  category?: string;
  createdAt: string;
}

export interface MessageStore {
  save(message: Omit<StoredMessage, "id" | "createdAt">): Promise<StoredMessage>;
}

class SupabaseStore implements MessageStore {
  private client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  async save(message: Omit<StoredMessage, "id" | "createdAt">): Promise<StoredMessage> {
    const { data, error } = await this.client
      .from("messages")
      .insert({ text: message.text, category: message.category ?? null })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      createdAt: data.created_at,
      text: data.text,
      category: data.category ?? undefined,
    };
  }
}

let store: MessageStore | null = null;

export function getStore(): MessageStore {
  if (!store) {
    store = new SupabaseStore();
  }
  return store;
}
