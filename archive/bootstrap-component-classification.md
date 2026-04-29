# Bootstrap Component Classification

This is a working classification for Bootstrap-derived patterns in the portal shell.

The goal is not to remove every Bootstrap class name. The goal is to distinguish:

- patterns that are already visually absorbed into the new shell language
- patterns that still carry legacy Bootstrap structure or emphasis
- patterns we should avoid using for new shell work

## Categories

### 1. Fully Absorbed

Meaning:
- The class name may still come from Bootstrap, but the visual meaning is now ours.
- The component behaves consistently with the shell strategy.

Criteria:
- color, spacing, border, radius, and emphasis are driven by our shell tokens
- the component no longer reads as recognizably "Bootstrap default"
- reusing it does not usually create visual debt

Examples:
- `btn-default`
- `btn-primary`
- `form-control` when used inside already-restyled shell forms
- `form-control-sm` when it maps to our compact control sizing

Notes:
- These should still be validated occasionally, but the class name alone is not a problem.

### 2. Partially Absorbed

Meaning:
- Some tokens have been updated, but the structure or interaction still feels legacy.

Criteria:
- colors may be acceptable, but spacing, hierarchy, or behavior still feels old
- the component may be serviceable in-place, but should not be copied blindly into new shell work

Examples:
- `nav-tabs`
- `table-sm`
- `alert`
- some `modal-header` / `modal-footer` combinations

Notes:
- These are good candidates for targeted shell wrappers or local overrides.

### 3. Legacy Structure

Meaning:
- The pattern still carries strong Bootstrap visual assumptions and often clashes with the calmer shell strategy.

Criteria:
- strong default emphasis
- heavy framing or legacy panel shape
- old interaction cues that compete with the new shell model

Examples:
- `card`
- `breadcrumb`
- `list-group-item-action`
- `thead-light`

Notes:
- These are the highest-value cleanup targets.
- They often need structural redesign, not just token substitution.

### 4. Transitional Wrappers

Meaning:
- We may continue using the underlying Bootstrap markup for implementation convenience, but only behind our own component styling.

Criteria:
- safe when wrapped
- unsafe when used raw
- useful for migration, but not a final design language

Examples:
- folder/file picker browsers built on `card` + `breadcrumb` + `list-group-item-action`
- admin tables using Bootstrap table markup but custom shell table styling
- tab containers using Bootstrap nav primitives with shell overrides

Notes:
- This is the practical migration category.
- The long-term aim is to make these wrappers explicit and predictable.

## First-Pass Assessment

### Likely Fully Absorbed

- `btn-default`
- `btn-primary`
- standard form controls that already inherit shell tokens

Reason:
- these are mostly semantic hooks now, not direct evidence of legacy appearance

### Likely Partially Absorbed

- `nav-tabs`
- `table-sm`
- `alert`
- generic modal sections like `modal-header` and `modal-footer`

Reason:
- many of these can be acceptable, but they still need contextual review

### Likely Legacy / High Attention

- `card`
- `breadcrumb`
- `list-group-item-action`
- `thead-light`

Reason:
- these repeatedly surface as "harsh", "loud", or "legacy" in shell-facing screens

## Current UX Signals

These recent UI issues are examples of why classification matters:

- Schedule and Data move pickers:
  - legacy `breadcrumb` emphasis
  - legacy picker framing
- Data tree and folder browsers:
  - `card` + `list-group-item-action` patterns read older than the shell
- shell/admin tables:
  - `thead-light` often feels too legacy compared to neutral shell surfaces

## Recommended Team Rule

For new shell work:

- Safe by default:
  - `btn-default`
  - `btn-primary`
  - already-restyled input classes

- Use with review:
  - `nav-tabs`
  - `table-sm`
  - `alert`

- Avoid raw usage:
  - `card`
  - `breadcrumb`
  - `list-group-item-action`
  - `thead-light`

## Next Useful Step

Turn this into a code-facing inventory:

- `fully-absorbed`
- `partial`
- `legacy`

and map real portal components into those buckets, starting with:

- Data
- Schedule
- Report shell
- landing/welcome pages

