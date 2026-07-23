import type { Estado } from "@/lib/types";
import { estadoStyles } from "@/lib/ui";

export function EstadoBadge({ estado }: { estado: Estado }) {
  const s = estadoStyles[estado];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {estado}
    </span>
  );
}
