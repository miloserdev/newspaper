import { test } from "node:test";
import assert from "node:assert/strict";
import { parseScriptTag, toReactProps } from "../lib/script-tags";

test("raw: a vendor snippet exactly as copied from the GoatCounter dashboard", () => {
  const t = parseScriptTag({ raw: '<script data-goatcounter="https://miloserdev.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>' });
  assert.deepEqual(t, { attrs: { "data-goatcounter": "https://miloserdev.goatcounter.com/count", async: true, src: "//gc.zgo.at/count.js" } });
});

test("raw: single quotes, unquoted values, inline bodies and self-closed tags", () => {
  assert.deepEqual(parseScriptTag({ raw: "<script defer src='/a.js' data-x=1></script>" })?.attrs, { defer: true, src: "/a.js", "data-x": "1" });
  assert.equal(parseScriptTag({ raw: "<script>window.x = 1;</script>" })?.inline, "window.x = 1;");
  assert.deepEqual(parseScriptTag({ raw: '<script src="/b.js" />' })?.attrs, { src: "/b.js" });
});

test("attributes form", () => {
  assert.deepEqual(parseScriptTag({ src: "/c.js", async: true, "data-k": "v", n: 3 }), { attrs: { src: "/c.js", async: true, "data-k": "v", n: "3" } });
  assert.equal(parseScriptTag({ inline: "  console.log(1) " })?.inline, "console.log(1)");
});

test("raw and attributes combine: explicit keys win", () => {
  const t = parseScriptTag({ raw: '<script src="/a.js" data-x="old"></script>', "data-x": "new", defer: true });
  assert.deepEqual(t?.attrs, { src: "/a.js", "data-x": "new", defer: true });
});

test("rejects everything that is not an object describing a script", () => {
  for (const bad of ["<script src=\"/a.js\"></script>", "not a tag", 42, null, [], {}, { raw: "not a script tag" }, { raw: 5 }, { raw: "<div></div>" }]) {
    assert.equal(parseScriptTag(bad), null, JSON.stringify(bad));
  }
});

test("maps attribute names React spells differently", () => {
  assert.deepEqual(toReactProps({ crossorigin: "anonymous", nomodule: true, "data-a": "b" }), { crossOrigin: "anonymous", noModule: true, "data-a": "b" });
});
