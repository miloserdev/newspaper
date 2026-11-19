"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Page-view counters like GoatCounter only count the first full page load; this site navigates on the client.
 * On every later route change report the new page, if such a counter is on the page.
 */
export function Analytics() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false; // the counter script counts the initial load itself
      return;
    }
    const t = setTimeout(() => {
      const gc = (window as unknown as { goatcounter?: { count?: (v: Record<string, string>) => void } }).goatcounter;
      gc?.count?.({ path: location.pathname + location.search, title: document.title });
    }, 50); // let the new page set its <title> first
    return () => clearTimeout(t);
  }, [pathname]);
  return null;
}
