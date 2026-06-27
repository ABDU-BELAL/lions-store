import { useEffectiveDiscount } from "@/hooks/useEffectiveDiscount";
import { useCurrency } from "@/i18n/CurrencyProvider";

export function CardPrice({ productId, price }: { productId: string; price: number }) {
  const { format } = useCurrency();
  const { percent } = useEffectiveDiscount(productId);
  const hasDiscount = percent > 0;
  const discounted = hasDiscount ? price * (1 - percent / 100) : price;

  if (!hasDiscount) {
    return <p className="mt-1 text-lg font-black text-gold">{format(price)}</p>;
  }
  return (
    <div className="mt-1 flex flex-col items-center gap-0.5">
      <span className="text-[11px] text-muted-foreground line-through opacity-80">{format(price)}</span>
      <span className="text-lg font-black text-gold flex items-center gap-1.5">
        <span className="text-[10px] font-extrabold bg-gold/20 text-gold rounded-full px-1.5 py-0.5">-{percent}%</span>
        {format(discounted)}
      </span>
    </div>
  );
}
