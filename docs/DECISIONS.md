# Engineering decisions

- Cloudscape is used directly to preserve AWS console density and accessible interaction patterns.
- FastAPI routers remain thin; services own domain rules and transactions.
- SQLite satisfies the assignment and requires a persistent disk in deployment.
- Raw passwords and session tokens are never persisted.
- Hosted-zone and record queries always scope through the authenticated owner.
- Offset pagination is appropriate for the educational dataset; sort fields are allow-listed.
- The BIND parser supports common record lines rather than attempting full RFC coverage.

## ADR — Cloudscape native visual modes

**Context:** Dark mode is an assignment bonus and must preserve the visual fidelity and accessibility of the AWS-style console.

**Decision:** Use Cloudscape `applyMode()` for Light and Dark rendering, with System resolved through `prefers-color-scheme`. Persist only the appearance preference in browser `localStorage`, initialize the effective mode before paint, and use Cloudscape components and design tokens for custom surfaces.

**Consequence:** Custom styles must avoid hard-coded light-only colors. New UI must use semantic, mode-aware tokens or native Cloudscape styling so it remains readable in both visual modes.
