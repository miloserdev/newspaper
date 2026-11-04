"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** On wide screens (3 columns) jumps straight to the article; on mobile the feed stays visible */
export function AutoOpen({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) router.replace(href);
  }, [href, router]);
  return null;
}
