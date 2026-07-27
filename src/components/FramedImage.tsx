import proframe from "@/assets/proframe.png.asset.json";

interface Props {
  src?: string | null;
  alt: string;
  fallbackIcon?: React.ReactNode;
  className?: string;
  /** When false, the decorative gold frame is hidden and only the image is shown. */
  framed?: boolean;
}

export function FramedImage({ src, alt, fallbackIcon, className = "", framed = true }: Props) {
  if (!framed) {
    return (
      <div className={`relative aspect-square p-3 flex items-center justify-center ${className}`}>
        {src ? (
          <img src={src} alt={alt} className="w-full h-full object-cover rounded-2xl" />
        ) : (
          <div className="w-full h-full grid place-items-center rounded-2xl bg-secondary text-3xl">
            {fallbackIcon ?? "🎮"}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative aspect-square p-6 flex items-center justify-center ${className}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_oklch(0.7_0.18_75/_18%),_transparent_65%)]" />
      <div className="relative w-full h-full grid place-items-center">
        {src ? (
          <img src={src} alt={alt} className="absolute inset-[18%] w-[64%] h-[64%] object-cover rounded-2xl z-10" />
        ) : (
          <div className="absolute inset-[18%] w-[64%] h-[64%] grid place-items-center rounded-2xl bg-secondary z-10 text-3xl">
            {fallbackIcon ?? "🎮"}
          </div>
        )}
        <img
          src={proframe.url}
          alt=""
          aria-hidden
          className="relative w-full h-full object-contain drop-shadow-[0_0_20px_oklch(0.7_0.18_75/_40%)]"
        />
      </div>
    </div>
  );
}
