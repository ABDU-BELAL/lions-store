import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProductDiscount } from "@/lib/shop.functions";
import { getMyVip } from "@/lib/vip.functions";
import { useAuth } from "@/hooks/useAuth";
import { listVipTiers } from "@/lib/vip.functions";

/**
 * Returns the effective discount percent for the signed-in user on a given product.
 * MAX(user manual discount, VIP tier discount). 0 when no user.
 */
export function useEffectiveDiscount(productId: string | null | undefined): {
  percent: number;
  loading: boolean;
} {
  const { user } = useAuth();
  const getDisc = useServerFn(getMyProductDiscount);
  const getVip = useServerFn(getMyVip);
  const getTiers = useServerFn(listVipTiers);

  const userDisc = useQuery({
    queryKey: ["my-product-discount", user?.id, productId],
    queryFn: () => getDisc({ data: { productId: productId as string } }),
    enabled: !!user && !!productId,
    staleTime: 60_000,
  });

  const vip = useQuery({
    queryKey: ["my-vip", user?.id],
    queryFn: () => getVip(),
    enabled: !!user,
    staleTime: 60_000,
  });

  const tiers = useQuery({
    queryKey: ["vip-tiers"],
    queryFn: () => getTiers(),
    enabled: !!user && !!vip.data && vip.data.level > 0,
    staleTime: 5 * 60_000,
  });

  if (!user || !productId) return { percent: 0, loading: false };

  const manual = userDisc.data?.percent ?? 0;
  const vipLevel = vip.data?.level ?? 0;
  const vipPercent = vipLevel > 0 ? Number((tiers.data ?? []).find((t) => t.level === vipLevel)?.discount_percent ?? 0) : 0;
  const percent = Math.max(manual, vipPercent);

  return {
    percent,
    loading: userDisc.isLoading || vip.isLoading || (vipLevel > 0 && tiers.isLoading),
  };
}
