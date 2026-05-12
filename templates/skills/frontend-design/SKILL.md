---
name: frontend-design
description: Building or modifying UI components, pages, or styles. Covers design-system reuse, accessibility, responsive defaults, and the team's loading / empty / error state conventions. Activate for any task involving JSX/TSX/Vue/Svelte files or CSS / Tailwind / styled-components.
---

# Frontend design skill

How this codebase wants UI built. Read before adding any page or component.

## Step 0 — map the design system FIRST

Before opening a new file, find what already exists:

```bash
# Find the design system primitives
ls components/ui/ 2>/dev/null || ls src/components/ui/ 2>/dev/null

# Find the token / theme file
grep -r "tailwind.config" --include="*.{js,ts,mjs}" -l
grep -r "createTheme\|defineTokens\|theme.ts\|theme.js" -l --include="*.{ts,tsx,js,jsx}"

# Find existing pages with similar patterns
find app pages src/pages src/app -name "*.{tsx,jsx,vue,svelte}" 2>/dev/null | head -20
```

If a primitive exists, **reuse it**. Do NOT introduce a parallel `<MyButton>` when `<Button>` is in the design system.

## Step 1 — match the existing routing / framework convention

| Framework | Convention check |
|---|---|
| Next.js App Router | `app/<route>/page.tsx` + `layout.tsx`. Server components by default; `"use client"` only where needed. |
| Next.js Pages Router | `pages/<route>.tsx`. `getServerSideProps` / `getStaticProps` data flow. |
| Remix | `routes/<route>.tsx` with `loader` / `action`. |
| Vue | Look at `pages/`, `<script setup>` vs Options API — match the existing style. |
| SvelteKit | `+page.svelte` / `+page.server.ts`. |

Don't mix conventions. If 90% of pages are server components, your new page is a server component by default.

## Step 2 — component composition order

For any new page:

1. Route file (entry point, minimal)
2. Layout / wrapper (if applicable)
3. Content sections (composed of design-system primitives)
4. Interactive elements (forms, dialogs)
5. **Loading state**
6. **Empty state**
7. **Error state**

Loading, empty, and error states are NOT optional. A page that ships without them is incomplete.

## Step 3 — accessibility checklist (non-negotiable)

- Every `<input>` has a label (linked via `htmlFor` / `id`, or wrapped, or `aria-label`)
- Every `<img>` has `alt` (decorative images use `alt=""`, not omitted)
- Every interactive element is keyboard-navigable (no `<div onClick>` without `role="button"` + `tabIndex={0}` + key handler)
- Focus rings visible — never `outline: none` without a replacement
- Color contrast: text 4.5:1, large text 3:1
- Form errors announced to screen readers (`role="alert"` or `aria-live`)

## Step 4 — responsive by default

Mobile-first. Use the design system's breakpoint conventions. Never fixed-width.

```tsx
// RIGHT
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

// WRONG
<div style={{ width: 1200, display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
```

Admin-only tools may justify desktop-only, but flag it explicitly in the PR.

## Step 5 — performance budget

- No image >500KB without explicit justification
- No new client-side library that duplicates existing functionality (don't add `react-select` if the design system has a `Select`)
- Code-split heavy interactive elements (modals, rich text editors) with dynamic imports
- Defer non-critical client JS

## Anti-patterns to avoid

- Re-implementing form controls from scratch
- Custom dialogs / dropdowns when the design system has them
- Inline styles for layout (use the utility classes / token system)
- One-off color values not in the token palette
- Skipping loading/empty/error states
- `dangerouslySetInnerHTML` without a sanitizer

## Before declaring done

Run the team's checks:
- Lint passes
- Typecheck passes (if applicable)
- Visual smoke test in dev mode
- Test on mobile viewport (Chrome DevTools device toolbar)
- Tab through the page with keyboard

If any of these fail, the page isn't done.
