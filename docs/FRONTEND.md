# Frontend

Next.js App Router pages live under `frontend/app`. A reusable `/route53` layout supplies Cloudscape top navigation, service side navigation, responsive content, notifications, loading state, and an error boundary. Hosted zones and records use dense Cloudscape tables with server-backed filters, sorting, pagination, selection, contextual actions, and safe modals.

All HTTP operations are centralized in `frontend/lib/api`. Forms retain values after failures and prevent duplicate submission. Generated system NS/SOA records are visible but cannot be edited or deleted; user-created NS records remain deletable. Secondary Route 53 sections render inside the same shell as explicit Coming Soon pages.

## Appearance

The root `ThemeProvider` supports three appearance preferences:

- **Light** always applies Cloudscape light mode.
- **Dark** always applies Cloudscape dark mode.
- **System** follows `prefers-color-scheme` and updates immediately when the operating-system setting changes.

System is the default. The preference is persisted as `light`, `dark`, or `system` in browser `localStorage` under the `route53-theme` key. A small initialization script runs before the application content is painted so a saved or system-derived mode is applied without a flash of the wrong theme; the provider then owns updates and media-query cleanup after hydration. UI surfaces use Cloudscape components and mode-aware design tokens rather than separate hand-authored palettes.
