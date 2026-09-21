import { createCn } from "cn/config";

// The default `cn` only knows Tailwind's built-in class groups, so a custom
// `--text-*` theme key (globals.css, e.g. `text-button`) isn't recognized as
// font-size — `text-` is ambiguous between color/size/alignment, and an
// unrecognized suffix falls into the color group, silently dropping
// whichever text-color class sits next to it (`text-white text-button` ->
// just `text-button`). Extending `font-size`/`tracking` here fixes that for
// every caller; import `cn` from here, never from the "cn" package directly.
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [{ text: ["body", "button", "meta", "eyebrow", "chip"] }],
      tracking: [{ tracking: ["eyebrow"] }],
    },
  },
});
