/** A <script> to put into every page's <head> (analytics etc.), configured in the root meta.json `scripts` */
export interface ScriptTag {
  /** attributes: src, async, defer, type, data-*, … (boolean attributes are `true`) */
  attrs: Record<string, string | true>;
  /** inline script body */
  inline?: string;
}

/** `<script data-x="1" async src="…"></script>` → attributes and body */
function parseSnippet(html: string): ScriptTag | null {
  const m = html.trim().match(/^<script\b([^>]*?)\/?>([\s\S]*?)(?:<\/script>)?$/i);
  if (!m) return null;
  const attrs: ScriptTag["attrs"] = {};
  for (const a of m[1].matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    attrs[a[1]] = a[2] ?? a[3] ?? a[4] ?? true;
  }
  const inline = m[2].trim();
  return { attrs, ...(inline ? { inline } : {}) };
}

/**
 * One entry of the root meta.json `scripts` array — always an object:
 *
 *   { "raw": "<script data-goatcounter=\"…\" async src=\"//gc.zgo.at/count.js\"></script>" }   // a vendor snippet, as copied
 *   { "src": "//gc.zgo.at/count.js", "async": true, "data-goatcounter": "…" }                  // attributes
 *   { "inline": "window.x = 1" }                                                               // inline body
 *
 * `raw` and attributes can be combined: explicit keys override what the snippet says.
 */
export function parseScriptTag(entry: unknown): ScriptTag | null {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const { raw, inline, ...rest } = entry as Record<string, unknown>;

  let attrs: ScriptTag["attrs"] = {};
  let body: string | undefined;
  if (raw !== undefined) {
    const snippet = typeof raw === "string" ? parseSnippet(raw) : null;
    if (!snippet) return null;
    attrs = snippet.attrs;
    body = snippet.inline;
  }
  for (const [k, v] of Object.entries(rest)) {
    if (v === true || typeof v === "string") attrs[k] = v;
    else if (typeof v === "number") attrs[k] = String(v);
  }
  if (typeof inline === "string" && inline.trim()) body = inline.trim();
  return Object.keys(attrs).length || body ? { attrs, ...(body ? { inline: body } : {}) } : null;
}

/** HTML attribute names that React spells differently */
const REACT_ATTR: Record<string, string> = {
  crossorigin: "crossOrigin",
  nomodule: "noModule",
  referrerpolicy: "referrerPolicy",
  fetchpriority: "fetchPriority",
  nonce: "nonce",
};

export const toReactProps = (attrs: ScriptTag["attrs"]) =>
  Object.fromEntries(Object.entries(attrs).map(([k, v]) => [REACT_ATTR[k.toLowerCase()] ?? k, v]));
