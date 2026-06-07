import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMyWalletTxns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("wallet_transactions")
      .select("id, type, amount, balance_after, description, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) { console.error("[db]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); };
    return data ?? [];
  });
