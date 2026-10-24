"use client";

import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Countdown({
  target,
  prefix = "",
  className,
  showIcon = true,
}: {
  target: string | Date | null | undefined;
  prefix?: string;
  className?: string;
  showIcon?: boolean;
}) {
  const [label, setLabel] = useState<string>("—");

  useEffect(() => {
    if (!target) {
      setLabel("No timer");
      return;
    }
    const tick = () => {
      const diff = new Date(target).getTime() - Date.now();
      if (diff <= 0) {
        setLabel("now");
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setLabel(mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m ${secs.toString().padStart(2, "0")}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  return (
    <span className={cn("inline-flex items-center gap-1.5 font-semibold tabular-nums", className)}>
      {showIcon ? <Clock3 className="h-3.5 w-3.5" /> : null}
      {prefix}
      {label}
    </span>
  );
}
