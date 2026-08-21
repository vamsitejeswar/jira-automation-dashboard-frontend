# HR Dashboard — Ticket Management Page Redesign Brief

## What this is

An internal HR dashboard inside an existing enterprise automation product ("Jira Automation Dashboard" — an onboarding/offboarding automation platform used by IT/Admin, with a separate, restricted view for HR staff). HR users have **no Jira login** — this page is the *only* place they see or act on onboarding/offboarding requests. They are not technical.

The page is a classic **master-detail view**: a list of requests on the left, full detail + an edit form for the selected request on the right. Redesign this page to feel like a modern, polished, professional enterprise SaaS product — think Linear, Notion, or Ashby's candidate/request views — not a generic admin-panel template.

## Audience & tone

- HR staff, non-technical. Language must stay plain and business-facing ("Request ID", "Employee Email", "Reporting Manager" — never "ticket", "webhook", "payload", "subtask", "API").
- The tone is calm and operational: this is a queue of real employee onboarding/offboarding requests HR works through daily, not a marketing page. Confidence and clarity over flourish.

## Existing design system (constraints — please work within these, don't invent a new visual language)

- **Stack**: React + Tailwind CSS, components in the shadcn "base-nova" style (rounded-xl cards, soft rings instead of harsh borders, base-ui primitives).
- **Palette already in use elsewhere in the product** (please reuse, don't replace):
  - Primary accent: **blue-600** (links, primary buttons, focus states)
  - Neutral surfaces: **slate** (light mode) / **neutral** (dark mode) — white/near-black cards on a very light slate-50 / near-black neutral-950 page background
  - Status colors (already fixed meanings across the whole app, keep consistent): **emerald** = success/completed, **amber** = warning/waiting/needs attention, **red** = failed/error, **sky** = informational, **orange** = a second neutral category color
  - Two record types exist: **Onboarding** (color: sky/blue) and **Offboarding** (color: orange) — this color pairing is used elsewhere in the app already and must carry through this page too (list rows, icons, badges) so the two types are always visually distinguishable at a glance, in both light and dark mode.
- **Typography**: system/Tailwind default sans-serif stack, no custom webfonts needed — this is a dense data product, not an editorial page.
- **Both light and dark mode** are required (the product has a working theme toggle already). Design both.
- **No generic AI-design tells**: no warm cream + serif, no near-black + neon-green/vermilion single accent, no broadsheet hairline-rule newspaper layout. This should look like a considered enterprise product, not a template.

## Page structure to design

### 1. Top bar (already exists, keep roughly as-is, just make it feel premium)
- Left: small square product logo + "HR Dashboard" title + "Onboarding & Offboarding" subtitle
- Right: light/dark/system theme toggle, user avatar + name + email, a labeled "Sign out" control (icon + visible text, not icon-only)

### 2. Filter bar (below top bar, above the list)
One row: a search input ("Search by employee name, email, or request ID"), a Type filter (All types / Onboarding / Offboarding), a Status filter (All statuses / Waiting for HR Update / In Progress / Completed / Failed), a date-range picker, a Search button, a Clear button. Needs to look clean at both desktop width and wrapped onto multiple lines on narrower screens.

### 3. Left panel — request list
Each row must show, scannably:
- A small type icon in a tinted circle/box (person-plus for onboarding, person-minus for offboarding), colored per the type-color system above
- Request ID (small, muted, monospace — secondary info)
- A type badge (Onboarding/Offboarding) and a status badge (e.g. "Waiting for HR Update", "Completed", "Failed", "In Progress") — status badge colors follow the status-color system above
- The employee/request title as the **primary, most prominent text** in the row (this matters more to HR than the raw ID)
- An optional small warning indicator when required fields are missing (e.g. "2 missing")
- A clear, unmistakable **selected** state — combine a background fill *with* a border/outline, not a background tint alone (a tint alone is the weaker of the standard options; pairing it with a border is what makes selection unmissable). A distinct **hover** state matters too: highlighting the row under the cursor measurably helps people track their place while scanning a list, so don't skip it.
- A consistent type-colored accent so a user can tell onboarding apart from offboarding requests while scanning the whole list without reading text — carry this via the **icon/avatar color and the type badge**, not a colored border stripe down the side of the row. (A thick colored border on one edge of a card/row is one of the most recognizable "AI-generated UI" tells — see the "avoid" list below. The icon + badge already carry the same information without it.)
- Comfortable, consistent row height; truncate long titles gracefully; hover state distinct from selected state

Below the list: standard pagination.

### 4. Right panel — selected request detail

**Record header** (top of the detail panel): a strong "identity" moment for the record — an icon/avatar tied to the type color, the request ID + type badge + status badge, the full request title as a real heading, and a "last activity" timestamp. This is the one place the record should feel like "a real person's request," not just a row of metadata.

**Employee details card**: Employee Email, Personal Email, Date of Joining (onboarding requests) *or* Last Working Day (offboarding requests — these two date fields are mutually exclusive per request type, never show both), Reporting Manager. Any field that's genuinely missing/blank should be visually flagged (not just left blank) so HR immediately sees what needs attention — but *only* the missing ones should stand out; present fields should stay quiet. Avoid decorating every single field identically (e.g. an icon on every single row) — that reads as generic/templated. Reserve visual emphasis for what's actually actionable.

**Ticket details card** (secondary, reference-only info from the underlying system): Status, Priority, Assignee, Reporter, Project, Created date, Last updated date. This is lower-priority information than Employee details — should read as clearly secondary in visual weight.

**Progress card**: a vertical stage timeline showing the automation's progress for this request (e.g. "Request created" → "Waiting for HR to update employee details" → "Account created" → "Closed"), each stage with a status icon (done/in-progress/pending/failed) and a timestamp where available. This should look like a real, polished timeline component — connecting line between stages, clear current-stage emphasis.

**Update details card** — the one editable section on the page: a small form with the specific fields HR can actually change (Employee Email + Personal Email + Date of Joining for onboarding; Last Working Day for offboarding), a short helper line explaining that saving takes effect immediately, and Reset/Save actions. **This card should be the one place on the page that visibly reads as "the actionable zone"** — distinct from the read-only cards above it — via a **soft tinted background wash and a small icon in the header only**. Do not add a colored border/ring around this card on top of the tint — a card with a colored outline is another one of the recognizable AI-generated-UI tells (see "avoid" list). The tint alone is enough to read as intentional. Everything else on the page should stay calm and quiet so this one section earns the attention.

**Status badges specifically**: never encode status by color alone. Every status badge already pairs color with a text label, which satisfies the minimum bar — keep that pairing everywhere status appears (list rows, detail header, anywhere else). If a status ever needs to show as icon-only anywhere (e.g. a very tight space), it still needs a second channel (shape or a text label on hover/tooltip), not color alone — this matters for colorblind users, who can't rely on hue to tell "waiting" from "failed" apart.

### 5. Empty / loading / error states
- No request selected yet (desktop): a calm placeholder in the right panel inviting the user to pick a request from the list.
- List loading: skeleton rows.
- Detail loading: a lightweight loading indicator, since this refetches live data each time a request is opened.
- Network/load error: a clear message + a retry action, never a raw error code.
- No results matching filters: a simple empty state, not a blank void.

### 6. Responsive behavior
On narrow/mobile widths, the list becomes full-width and selecting a request replaces it with the full-width detail view plus a "Back to list" control — there is no side-by-side split below a certain width.

## What "modern" means here — be specific, not generic

- Confident but restrained use of color: the type-color system (sky/orange) and status-color system (emerald/amber/red) should be the *only* color signals on the page, used consistently and meaningfully — not scattered decoratively.
- Clear typographic hierarchy: one obvious "most important text" per row/section (the person/request, not the ID), everything else demonstrably secondary.
- Generous, consistent spacing and alignment — no ad-hoc gaps, no misaligned icon/text baselines.
- A real distinction in visual weight between "information to read" and "the one thing you can act on."
- Selection and hover states that are unmistakable, not subtle to the point of being missable.
- Should feel calm and fast to scan — this is a work queue someone uses many times a day, not a page someone admires once.

## Deliverable

A high-fidelity design (light + dark mode) of this master-detail page: the list panel with 4–5 example request rows (mix of onboarding/offboarding, mix of statuses, at least one with a missing-field flag), and the detail panel fully populated for one selected onboarding request and, if possible, a second pass showing an offboarding request's detail (to confirm the Last Working Day vs Date of Joining distinction reads clearly). Use realistic placeholder content (real-sounding names, emails, dates) — not lorem ipsum or "Field 1 / Field 2."
