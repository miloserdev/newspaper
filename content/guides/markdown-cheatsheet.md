---
title: Markdown cheatsheet
description: Everything the renderer supports — headings, lists, quotes, callouts, code, tables.
tags: [markdown, guide]
date: 2026-10-29
---

# Heading 1 inside the text

A regular paragraph with **bold**, *italic*, ~~strikethrough~~, `inline code` and an [external link](https://nextjs.org). A link to a missing note: [[No such note]].

## Heading 2

### Heading 3

#### Heading 4

- First level
  - Second level
    - Third level
- Another item

1. One
2. Two
   1. Nested
   2. Another

- [x] Done
- [ ] In progress

---

> A regular quote that can be quite long
> and wrap onto several lines.

> [!note] Note
> This is an Obsidian-style callout.

> [!warning] Careful
> A warning with **formatting** and `code`.

> [!tip]
> A tip without a title.

```ts
export async function GET(req: Request) {
  const veryLongLine = "this line is intentionally very long to check horizontal scrolling of the code block without breaking the layout";
  return Response.json({ ok: true, veryLongLine });
}
```

```
a block without a language
```

    an indented code block

Text with a very long word: Pneumonoultramicroscopicsilicovolcanoconiosis_Pneumonoultramicroscopicsilicovolcanoconiosis_Pneumonoultramicroscopicsilicovolcanoconiosis.

| Column A | Column B | Column C | Column D | Column E | Column F |
| --- | :---: | ---: | --- | --- | --- |
| a long value to stretch the table | centered | right | another value | and one more | the last value in the row |

<details>
<summary>HTML block</summary>
Raw HTML.
</details>
