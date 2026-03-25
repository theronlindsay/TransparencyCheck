# AI Assistant Summarizer Reference

This document explains the floating AI assistant architecture used in the client app.

## Goal

Provide one global AI popup that:

- Is opened by a floating circular button in the bottom-left.
- Knows the current route/page context.
- Supports multiple page data sources over time.
- On bill pages, surfaces a summarize suggestion above the chatbox.
- On suggestion click, renders the existing bill summarizer UI as a chat card.

## Files

- `apps/client/src/lib/Components/AIAssistant.svelte`
- `apps/client/src/lib/Components/AIAssistantLauncher.svelte`
- `apps/client/src/lib/Components/AIAssistantPanel.svelte`
- `apps/client/src/lib/stores/assistant-context.js`
- `apps/client/src/routes/+layout.svelte`
- `apps/client/src/routes/bill/[id]/+page.svelte`

## Component Responsibilities

### `AIAssistant.svelte`

- Global wrapper mounted in app layout.
- Owns open/close state.
- Connects assistant panel to derived page context store.

### `AIAssistantLauncher.svelte`

- Floating circular trigger button.
- Fixed above bottom nav to avoid overlap.

### `AIAssistantPanel.svelte`

- Popup UI and message list.
- Handles user chat input and OpenAI request flow.
- Shows context-aware suggestions.
- Renders `AISummarizer` card when summarize suggestion is clicked.

## Context Store Design

`assistant-context.js` maintains a source registry so route-level pages can register context providers.

Public API:

- `registerAssistantSource(sourceId, config)`
- `updateAssistantSourceData(sourceId, data)`
- `unregisterAssistantSource(sourceId)`
- `assistantPageContext` (derived store)

Each source config supports:

- `pageType`
- `pageLabel`
- `isActive(pathname)`
- `data`
- `dataSources`
- `suggestions`

This allows future expansion to table/search/home pages without changing the assistant shell.

## Bill Page Integration

`routes/bill/[id]/+page.svelte` registers source `bill-page` and updates data with:

- `billNumber`
- `billTitle`
- `billSummary`
- `billText`

Suggestions include:

- `summarize-bill` with action `open-summarizer`

The panel checks this suggestion and displays the summarize prompt above chat input.

## Extending To New Pages

1. In a route component, call `registerAssistantSource()` in lifecycle setup.
2. Provide `isActive()` matcher for the route path.
3. Feed context with `updateAssistantSourceData()` as data loads.
4. Add optional suggestions specific to that page type.
5. Call `unregisterAssistantSource()` on route teardown.

## Notes

- Bottom nav no longer contains the old AI tab.
- Legacy `showAISummarizer` store is no longer used by routes.
- Assistant is now a single global entry point.
