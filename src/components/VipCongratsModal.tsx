import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getUnreadVipPromotions, markNotificationRead, listVipTiers } from "@/lib/vip.functions";
import { VipBadge } from "./VipBadge";
import { useAuth } from "@/hooks/useAuth";
import { X } from "lucide-react";

export function VipCongratsModal() {
  const { user } = useAuth();
  const getUnread = useServerFn(getUnreadVipPromotions);
  const markRead = useServerFn(markNotificationRead);
  const listTiers = useServerFn(listVipTiers);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const unread = useQuery({
    queryKey: ["vip-unread", user?.id],
    queryFn: () => getUnread(),
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const tiers = useQuery({
    queryKey: ["vip-tiers"],
    queryFn: () => listTiers(),
    enabled: !!user && !!unread.data,
  });

  const mark = useMutation({
    mutationFn: (id: string) => markRead({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vip-unread"] }),
  });

  useEffect(() => { if (unread.data) setOpen(true); }, [unread.data]);

  if (!open || !unread.data) return null;

  const data = unread.data;
  const newLevel = (data.data as { new_level?: number } | null)?.new_level ?? 0;
  const tier = (tiers.data ?? []).find((t) => t.level === newLevel);

  const close = () => {
    setOpen(false);
    mark.mutate(data.id);
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 backdrop-blur-md p-4 animate-[vipfade_0.3s_ease-out]">
      <style>{`
        @keyframes vipfade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes vippop { 0% { transform: scale(0.5) rotate(-12deg); opacity: 0; } 60% { transform: scale(1.08) rotate(3deg); } 100% { transform: scale(1) rotate(0); opacity: 1; } }
        @keyframes confetti { 0% { transform: translateY(-100vh) rotate(0); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }
      `}</style>
      {/* Confetti */}
      {Array.from({ length: 30 }).map((_, i) => (
        <span
          key={i}
          className="absolute w-2 h-3 pointer-events-none"
          style={{
            left: `${Math.random() * 100}%`,
            top: `-10vh`,
            background: ["#d4af37", "#ffd96b", "#fb7185", "#7dd3fc", "#a78bfa"][i % 5],
            animation: `confetti ${2 + Math.random() * 2}s linear ${Math.random() * 1.5}s infinite`,
            borderRadius: 2,
          }}
        />
      ))}
      <div className="relative w-full max-w-md rounded-3xl bg-card border-gold shadow-card p-8 text-center" style={{ animation: "vippop 0.6s cubic-bezier(.34,1.56,.64,1)" }}>
        <button onClick={close} className="absolute top-3 right-3 grid place-items-center size-9 rounded-full bg-secondary hover:bg-secondary/80">
          <X className="size-5" />
        </button>
        <div className="grid place-items-center mb-4">
          <VipBadge level={newLevel} color={tier?.color_hex} accent={tier?.accent_hex} current size={140} />
        </div>
        <h2 className="text-2xl font-black text-gold-gradient">{data.title}</h2>
        <p className="mt-2 text-foreground/90">{data.body}</p>
        {tier && (
          <p className="mt-3 text-sm text-muted-foreground">
            خصم دائم {Number(tier.discount_percent).toFixed(1)}% على جميع المنتجات
          </p>
        )}
        <button
          onClick={close}
          className="mt-6 rounded-full bg-gold-gradient text-primary-foreground font-extrabold px-6 py-2.5 shadow-gold"
        >
          رائع! 🎉
        </button>
      </div>
    </div>
  );
}
