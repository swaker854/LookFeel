# StyleBI Shell Portal Roadmap

## Purpose

This document captures portal-specific shell follow-up items that should be reviewed separately from the foundational shell strategy, shell design spec, and shell implementation roadmap.

These items are not core shell foundations. They are portal-specific applications of the shell language where current UI behavior should be reviewed against the broader Figma-inspired direction.

## Relationship To Other Docs

Use this document for:

- portal-specific shell review items
- portal UI treatments that should be adjusted to better match the shell strategy
- follow-up refinements after the foundational shell token and widget work

Do not treat this file as the source of truth for:

- foundational shell tokens
- shell-wide component rules
- Composer-specific state language
- visualization-specific color or density behavior

Related docs:

- [theme-strategy-overview.md](E:\home\dev\github\lookfeel\theme-strategy-overview.md)
- [shell-design-spec.md](E:\home\dev\github\lookfeel\shell-design-spec.md)
- [shell-palette-spec.md](E:\home\dev\github\lookfeel\shell-palette-spec.md)
- [shell-implementation-roadmap.md](E:\home\dev\github\lookfeel\shell-implementation-roadmap.md)

## Portal Review Items

## 1. Repository Tree Selected Dashboard State

### Current issue

In the portal repository tree, the selected dashboard state can easily read too strongly when combined with a calm, unified left rail.

The accent appears in multiple places at once:

- left selection bar
- dashboard icon
- item label text

In a unified left-side panel where search and tree content share the same background, this kind of selection stands out even more and can feel louder than intended.

### Why it conflicts with the shell strategy

The shell strategy calls for:

- neutral-first hierarchy
- one routine accent used with restraint
- emphasis through structure and state rather than broad color application

In a repository tree, selection is a routine navigational state, not a primary action. It should not consume the primary accent as full content color, especially when the surrounding rail is intentionally calm and continuous.

### Recommendation

Use a quieter selected-state treatment made from:

- a subtle neutral or warm selected background
- neutral text
- neutral icon treatment
- an optional thin primary leading indicator only if extra emphasis is needed

Do not combine:

- primary text
- primary icon
- primary selection bar

in the same routine selected tree state.

### Suggested treatment

- background: `--inet-shell-selected-bg-color` or a similarly soft neutral selected fill
- text: `--inet-text-strong-color`
- icon: `--inet-text-muted-color` or `--inet-text-color`
- optional leading indicator: `2px solid var(--inet-primary-color)`

### Design intent

The repository tree should feel calm and structural, closer to a Figma-like navigation state than a strong callout.

Primary orange should be demoted from full selected-item coloring to a small positional cue only.

This becomes even more important when the search row and repository tree are treated as one continuous left rail rather than separate boxed panels.

### Implementation note

If the selected background alone provides enough clarity, remove the orange leading bar entirely.

If extra scanability is still needed, keep only the thin leading bar and leave text and icon neutral.

## 2. Repository Search Bar Height And Vertical Padding

### Current issue

In the portal repository area, the search field appears vertically compressed.

The control reads as too short and the text sits with too little internal vertical breathing room, which makes the left rail feel less polished than the rest of the shell.

### Design tension

One possible reason for the current sizing is to visually align the search row with the dashboard action strip on the right when a dashboard is open.

That alignment goal is reasonable, but it should not be achieved by making the input itself feel cramped.

There is also a broader structural question:

- should the search field live inside its own panel-like strip
- or should it read as part of the same left rail as the repository tree

The stronger direction is the second one.

### Recommendation

Keep alignment at the row level, not by shrinking the search input below normal shell control sizing.

Do not restore a separate search panel if its only purpose is to create visual distinction through boxed framing.

Instead, let the search area and repository tree share the same left-panel background so the rail reads as one continuous structure.

Use this approach:

- let the repository search row and dashboard action row share a common overall bar height
- keep the search input itself at normal shell input height
- vertically center the right-side actions within their row instead of compressing the input to match them
- keep the left rail visually unified rather than segmenting search and tree into separate panels

### Suggested treatment

- search input height: `30px`
- search input horizontal padding: `0 8px`
- vertical centering should come from input height and line-height, not from overly tight padding
- row-level alignment should be handled by the surrounding toolbar/search container
- search row background should match the repository panel background
- use a very subtle separator under the search row or above the repository label only if the transition into tree content needs more structure

### Design intent

The portal should align adjacent top-row structures without making the search field feel undersized.

The goal is to align containers, not preserve a cramped control.

The left side should read as a continuous rail, not as a stack of small boxed sections.

### Implementation note

If exact visual alignment with the right-side action strip is still needed, adjust the shared row container height and the vertical centering of icons/actions on the right before reducing the search field height.

If the search row and repository tree begin to visually blend too much, introduce separation with a light divider or spacing rhythm rather than a distinct panel fill.

## 3. Portal Action And Menu Hover Treatment

### Current issue

In portal-level action rows, in-widget action menus, and portal dropdown menus, hover states can become too boxed and too visually explicit.

When hovered, the actions read like a row of small framed buttons or pills rather than quiet shell actions.

In some cases, the hover/background treatment also shifts toward a cool tinted fill, such as a pale blue hover state, that does not match the warmer neutral shell direction.

### Why it conflicts with the shell strategy

The shell direction calls for:

- minimal persistent chrome
- neutral-first hierarchy
- emphasis through structure and state rather than decorative framing
- ghost-style passive actions where appropriate

The current hover treatment reintroduces:

- visible button boxing around each icon
- strong separation between adjacent actions
- cool-tinted hover surfaces that feel detached from the shell palette

This makes the portal and widget action areas feel more like legacy utility chrome than quiet, Figma-like action surfaces.

The same issue appears in dropdown and action menus where routine menu-item hover states use a cool tinted background instead of a neutral shell hover surface.

### Recommendation

Treat these actions as ghost controls by default.

Hover should not turn every icon into a distinct outlined mini-button unless the design is intentionally using a grouped control pattern.

Routine portal menu-item hover states should also use the same neutral shell hover family rather than a cool highlighted fill.

Use this approach:

- default state should be borderless or nearly borderless
- hover should use a subtle neutral fill
- icon emphasis should come from slightly stronger icon color and a light background change
- active or open states can use a somewhat stronger neutral or soft-primary treatment only when real state meaning exists
- menu items should hover with the same quiet warm-neutral logic as icon actions

### Suggested treatment

- default: ghost icon action with minimal or no visible box
- hover background: `surface-hover` or equivalent warm-neutral hover fill
- hover border: none, or only a very low-contrast boundary if needed for clarity
- active/open state: subtle neutral raised state or restrained soft-primary state
- avoid cool blue hover fills in routine shell action areas
- menu-item hover should use the same neutral hover surface, with no cool highlighted background for routine actions

### Design intent

Portal and widget actions should feel lightweight and integrated into the shell, not like rows of small standalone buttons.

If actions need grouping, the grouping should come from a shared quiet container rather than from each icon becoming its own prominent framed unit on hover.

Portal menus should feel like quiet shell overlays, with hover states that support scanability without looking like selected analytical states or colored callouts.

### Implementation note

Where action rows are already grouped, prefer one subtle group container with quiet ghost actions inside it.

Do not rely on per-icon boxed hover states as the main affordance unless a specific action cluster needs stronger containment for usability reasons.

Apply the same hover logic to portal dropdown and flyout menu items so action rows and menus feel like one coherent shell language.

## 4. Portal Left-Rail Tree Row Height Consistency

### Current issue

Portal left-rail tree rows are not consistently using the same compact navigation rhythm.

In sections such as Schedule Tasks, selected tree rows can appear too tall and too padded compared with the calmer repository-tree direction.

This makes the left rail feel uneven from section to section and gives routine navigation items more visual weight than they need.

### Why it conflicts with the shell strategy

The shell direction calls for:

- compact, precise controls
- consistent spacing
- quiet navigation structure
- emphasis through restrained state treatment rather than oversized row blocks

When one tree uses a larger row model, the orange selection indicator also becomes more visually dominant because it is attached to a taller target.

### Recommendation

Use one shared left-rail tree row model across portal sections wherever the interaction pattern is fundamentally the same.

Repository trees, schedule trees, and similar left-side navigation structures should align to the same compact sizing and spacing rhythm unless there is a clear usability reason to diverge.

Use this approach:

- reduce row height to the same compact shell list/nav range
- reduce excess vertical padding around icons and labels
- keep icon-to-label spacing tight and consistent
- preserve selected-state clarity without relying on oversized row blocks

### Suggested treatment

- target row height: approximately `30-34px`
- compact icon and label alignment
- selected state should stay quiet: subtle background if needed, neutral content, optional thin primary locator
- avoid section-specific oversized tree-row patterns unless the section truly needs a different interaction model

### Design intent

The entire portal left rail should feel like one coherent navigation system rather than a collection of unrelated tree widgets with different densities.

Tree rows should feel compact, scannable, and structurally calm.

### Implementation note

Audit repository, schedule, and other portal left-rail tree/list patterns together so row height, padding, icon sizing, and selected-state treatment can be normalized as one shared shell behavior.

## 5. Dialog Field Validation Tone And Error Persistence

### Current issue

In portal dialogs such as the dashboard email dialog, required-field validation can feel too loud because multiple semantic-error cues are stacked at once.

Typical examples include:

- error-colored border
- error-colored message text
- extra error icon

This makes a simple required-field validation feel more severe than it needs to be.

### Why it conflicts with the shell strategy

The shell direction calls for restrained semantic usage.

Validation should be clear, but it should not overwhelm the dialog chrome or make routine form completion feel visually harsh.

### Recommendation

Use one primary error cue on the field and one supporting explanation cue, rather than layering several high-attention signals at the same time.

For simple required-field validation, an inline helper/error message inside the field area is an appropriate option and fits the quieter shell language better than a separate loud warning line plus icon plus border treatment.

Use this approach:

- keep the field label neutral
- allow the helper/error text to appear inside the field area
- avoid a separate external warning label when inline helper text is sufficient
- remove the extra error icon unless it is required for consistency or accessibility

### Border-state behavior

Error borders should be transient, not sticky.

When the field is valid, the border should return to the normal neutral input border.

Recommended behavior:

- empty and validated/submitted: show error state
- invalid while editing: keep a restrained error state only as long as the field is actually invalid
- valid content present: return border to the normal neutral border
- remove the error/helper message once the field is valid, unless a non-error hint still needs to remain

### Suggested treatment

- label: neutral
- invalid state: restrained danger border plus inline helper text inside the field area
- valid state: standard neutral input border, no persistent error styling
- avoid combining strong red border, red message text, and red icon for simple required-field errors

### Design intent

Validation should feel clear and supportive, not punitive.

The dialog should preserve a calm shell tone even when showing an error.

### Implementation note

Inline helper text inside the field works best for simple required single-line inputs.

If a field later becomes a more complex tokenized multi-address control, validation/help messaging may need to move to a dedicated helper area below the field to avoid competing with entered content.
