# PostHog Integration Report

**Project:** TransparencyCheck
**Framework:** SvelteKit (static build + Capacitor)
**Date:** 2026-03-23
**PostHog Host:** https://us.i.posthog.com

---

## Summary

PostHog was integrated client-side into the TransparencyCheck SvelteKit app. Because the project uses `@sveltejs/adapter-static` with SSR disabled, all instrumentation is browser-only via `posthog-js`. No server-side SDK or reverse proxy was needed.

---

## Files Modified

| File | Change |
|------|--------|
| `apps/client/.env` | Added `PUBLIC_POSTHOG_PROJECT_TOKEN` and `PUBLIC_POSTHOG_HOST` |
| `apps/client/src/hooks.client.js` | Created — initializes PostHog and captures client-side exceptions |
| `apps/client/svelte.config.js` | Added `paths: { relative: false }` for session replay compatibility |
| `apps/client/src/lib/Components/Bill.svelte` | Added `bill_viewed` event |
| `apps/client/src/routes/+page.svelte` | Added `bills_load_error` and `congress_search_initiated` events |
| `apps/client/src/lib/Components/FilterPanel.svelte` | Added `bills_filtered` event |
| `apps/client/src/lib/Components/BottomTabBar.svelte` | Added `ai_summarizer_opened` event |
| `apps/client/src/lib/Components/AISummarizer.svelte` | Added `ai_summary_generated`, `ai_summary_error`, `ai_followup_sent` events |
| `apps/client/src/routes/bill/[id]/+page.svelte` | Added `bill_pdf_opened` and `bill_pdf_closed` events |

---

## Events Tracked

| Event | Description | File |
|-------|-------------|------|
| `bill_viewed` | User clicks a bill card to view its detail page | `Bill.svelte` |
| `congress_search_initiated` | User triggers a live Congress.gov search | `+page.svelte` |
| `bills_filtered` | User resets the filter panel | `FilterPanel.svelte` |
| `ai_summarizer_opened` | User opens the AI summarizer from the tab bar | `BottomTabBar.svelte` |
| `ai_summary_generated` | AI successfully generates a bill summary | `AISummarizer.svelte` |
| `ai_summary_error` | AI summary fails (API or validation error) | `AISummarizer.svelte` |
| `ai_followup_sent` | User sends a follow-up question in AI chat | `AISummarizer.svelte` |
| `bill_pdf_opened` | User opens the PDF viewer on a bill detail page | `bill/[id]/+page.svelte` |
| `bill_pdf_closed` | User closes the mobile PDF viewer | `bill/[id]/+page.svelte` |
| `bills_load_error` | Bills list fails to load from the API | `+page.svelte` |

---

## Dashboard

**Analytics basics**
https://us.posthog.com/project/353999/dashboard/1390873

### Insights

| Insight | Type | URL |
|---------|------|-----|
| Bill Views & Congress Searches | Trend | https://us.posthog.com/project/353999/insights/ylOcWDGt |
| AI Summarizer Funnel | Funnel (opened → generated) | https://us.posthog.com/project/353999/insights/L5S8JNtS |
| Error Rates | Trend | https://us.posthog.com/project/353999/insights/JS1DcTtv |
| PDF Engagement | Trend | https://us.posthog.com/project/353999/insights/nZ5LqcRr |
| Feature Usage Overview | Bar chart | https://us.posthog.com/project/353999/insights/mjtbiAjH |
