import proframe from "@/assets/proframe.png.asset.json";

interface Props {
  title: string;
  image: string;
  badge?: string;
}

export function ProductCard({ title, image, badge }: Props) {
  return (
    <button className="group relative w-full text-right">
      <div className="relative rounded-2xl overflow-hidden bg-dark-gradient shadow-card border border-gold/20 transition-transform group-hover:-translate-y-1 group-hover:shadow-gold">
        {/* Frame container */}
        <div className="relative aspect-square p-6 flex items-center justify-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_oklch(0.7_0.18_75/_18%),_transparent_65%)]" />
          <div className="relative w-full h-full grid place-items-center">
            <img src={image} alt={title} className="absolute inset-[18%] w-[64%] h-[64%] object-cover rounded-2xl shadow-card z-10" />
            <img src={proframe.url} alt="" aria-hidden className="relative w-full h-full object-contain drop-shadow-[0_0_20px_oklch(0.7_0.18_75/_40%)]" />
          </div>
        </div>

        <div className="px-4 pb-4 pt-1 text-center">
          <h3 className="text-base font-extrabold text-gold-gradient">{title}</h3>
          {badge && <p className="mt-1 text-[11px] text-muted-foreground">{badge}</p>}
        </div>

        <div className="absolute inset-x-0 top-0 h-1 bg-gold-gradient opacity-80" />
      </div>
    </button>
  );
}
