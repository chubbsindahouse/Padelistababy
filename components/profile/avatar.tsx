import Image from "next/image";
import { getInitials, cn } from "@/lib/utils";

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_MAP = {
  sm: { container: "w-8 h-8",   text: "text-xs",   px: 32 },
  md: { container: "w-10 h-10", text: "text-sm",   px: 40 },
  lg: { container: "w-14 h-14", text: "text-base", px: 56 },
  xl: { container: "w-20 h-20", text: "text-xl",   px: 80 },
};

const GRADIENTS = [
  "from-cyan-500 to-blue-600",
  "from-blue-500 to-indigo-600",
  "from-violet-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-pink-500 to-rose-600",
  "from-amber-500 to-orange-600",
  "from-cyan-400 to-teal-600",
  "from-indigo-400 to-blue-600",
];

function nameGradient(name: string): string {
  let hash = 0;
  for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

export function Avatar({ name, avatarUrl, size = "md", className }: AvatarProps) {
  const { container, text, px } = SIZE_MAP[size];

  if (avatarUrl) {
    return (
      <div className={cn("rounded-full overflow-hidden shrink-0", container, className)}>
        <Image src={avatarUrl} alt={name} width={px} height={px}
          className="object-cover w-full h-full" />
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-full shrink-0 flex items-center justify-center font-bold text-white bg-gradient-to-br",
      container, text, nameGradient(name), className
    )}>
      {getInitials(name)}
    </div>
  );
}
