import type { CSSProperties, ReactNode } from "react";

type MetricPillProps = {
  icon: ReactNode;
  label: string;
  tone?: "timer";
  urgent?: boolean;
  progress?: string;
};

export function MetricPill({
  icon,
  label,
  tone,
  urgent,
  progress,
}: MetricPillProps) {
  const className = [
    "metric",
    tone === "timer" ? "timer" : "",
    urgent ? "urgent" : "",
  ].filter(Boolean).join(" ");

  return (
    <span
      className={className}
      style={progress ? ({ "--timer-progress": progress } as CSSProperties) : undefined}
    >
      {tone === "timer" ? <span className="metric-progress" aria-hidden="true" /> : null}
      {icon}
      {label}
    </span>
  );
}
