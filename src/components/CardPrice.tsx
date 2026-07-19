import { useEffectiveDiscount } from "@/hooks/useEffectiveDiscount";
import { useCurrency } from "@/i18n/CurrencyProvider";

export function CardPrice({ productId, price, priceUsd }: { productId: string; price: number; priceUsd?: number | null }) {
  const { formatDual } = useCurrency();
  const { percent } = useEffectiveDiscount(productId);
  const hasDiscount = percent > 0;
  const discounted = hasDiscount ? price * (1 - percent / 100) : price;
  const usd = priceUsd != null && Number(priceUsd) > 0 ? Number(priceUsd) : null;
  const discountedUsd = usd != null ? (hasDiscount ? usd * (1 - percent / 100) : usd) : null;

  if (!hasDiscount) {
    return <p className="mt-1 text-lg font-black text-gold">{formatDual(price, usd)}</p>;
  }
  return (
    <div className="mt-1 flex flex-col items-center gap-0.5">
      <span className="text-[11px] text-muted-foreground line-through opacity-80">{formatDual(price, usd)}</span>
      <span className="text-lg font-black text-gold flex items-center gap-1.5">
        <span className="text-[10px] font-extrabold bg-gold/20 text-gold rounded-full px-1.5 py-0.5">-{percent}%</span>
        {formatDual(discounted, discountedUsd)}
      </span>
    </div>
  );
}
