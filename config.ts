/**
 * Engine config. Everything you need to change lives here.
 * Menu sections are not defined here, but by meta.json files inside content directories
 * (a directory with `"root": true` = a menu item; title, description, icon, color come from there).
 * The site itself (name, tagline, icon) is described by meta.json in the contentDir root.
 */

export const config = {
  /** Root content directory (e.g. an Obsidian vault). Relative to the project root, or an absolute path */
  contentDir: "./content",
  /** Links at the bottom of the menu */
  links: [
    { title: "Next.js", href: "https://nextjs.org" },
    { title: "shadcn/ui", href: "https://ui.shadcn.com" },
  ],
  /** Show documents with `draft: true` */
  showDrafts: false,
};
