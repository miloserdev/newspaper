import { icons, Folder } from "lucide-react";

/** Server component: lucide icon by the name from meta.json (e.g. "Cpu") */
export function SectionIcon({ name, color, className }: { name: string; color?: string; className?: string }) {
  const I = (icons as Record<string, typeof Folder>)[name] ?? Folder;
  return <I className={className} style={color ? { color } : undefined} />;
}
