# Boss Project Manager — agent rules

- Market studies are mirrored into a project (one phase, one task per report section, one budget line per section) so they reuse the calendar, live tracking and budget engines; keep the mirror as the single source of truth for a study's dates and costs instead of duplicating planning logic in study pages.
- Propagate child content changes to parent document timestamps with RLS-respecting database triggers, so audits read the latest modification regardless of the editing flow.
