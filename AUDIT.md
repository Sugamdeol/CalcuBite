# CalcuBite audit — 2026-10-02

Reviewed the landing page, app shell, camera/upload flows, barcode and text search, AI proxy, result rendering, diary, profile, goals/dashboard, local persistence, cloud merge, themes and service worker.

## Fixed

| Area | Finding | Change |
|---|---|---|
| Diary | Today button passed a click event as a date offset and threw `Invalid time value` | Numeric offsets and local-calendar day keys |
| Portions | Edited meal calories left macros unchanged | Scale macros with the edited energy amount |
| Diary sync | Cloud merge could restore removed meals | Persist deletion IDs and filter merged entries |
| Persistence | Scan history and goals disappeared when cloud was unavailable | Save/load local history and goals; safe storage fallback |
| History | Results could be logged multiple times | One history insertion per displayed analysis |
| Dashboard | Lists depended on placeholders removed during the first render | Refresh history/goals without placeholder dependencies |
| Dashboard | Diary chart was destroyed on close and missing on reopen | Recreate the chart on subsequent opens |
| Camera | Permission failure still marked camera as running | Only update state on successful acquisition; validate video dimensions |
| Barcode | Scanner acquired a second camera stream | Decode the existing stream |
| Upload | Large/non-image files and repeat selection were not handled | Image validation, 15 MB limit, resized image, explicit decode errors and input reset |
| Requests | Overlapping searches could overwrite results, with indefinite network waits | Shared busy guard, cancellation, client deadlines and bounded server fallback |
| Rendering | Untrusted AI/database/user strings were interpolated into HTML | Escape analysis/chat/picker/history/goal output and filter image URLs |
| Data honesty | Random daily values and invented chart metrics | Missing-value states and charts based on reported nutrients |
| Attribution | AI text output could be shown as verified Open Food Facts data | Explicit community-data versus AI-estimate attribution |
| UI | Macros unlabeled; controls small; mobile top navigation consumed space | Visible macro labels, 44 px controls, bottom navigation, compact headings |
| Dialogs | No shared focus management or Escape behavior | Dialog semantics, keyboard close, focus trap and focus restoration |
| Theme | Theme preference disappeared on reload | Persisted/system theme selection; result chart colors follow theme |
| PWA | Cache-first responses stayed stale and caching was too broad | Network-first allowed app assets; bypass POST, API and external traffic |
| API | Provider errors could expose upstream details; retries lacked an overall bound | Generic actionable errors, no-store responses and 42-second fallback deadline |

## Verification

- `node --test tests/*.test.js`: 8 tests passed (numeric parsing, escaping, response validation, calendar dates, storage fallback, cancellation/deadline, offline history/goals, diary deletion).
- JavaScript syntax checks passed for modified application files and the proxy.
- Live preview: daily diary opens; previous-day navigation works; Escape closes and restores focus; dashboard and nested goal editor open; a fictional goal survives reload.
- Live preview: food search for oats returned an AI analysis; one history record was created. Changing the meal to 200 kcal scaled macros and saved the breakfast entry shown in the diary.
- Actual app inspected in 320/390/768 px iframe viewports. No horizontal overflow at 320 and 390. A 768 px meal-grid overflow was found, corrected and rechecked with equal content/viewport width.
- Live analysis cancellation restores enabled controls with a cancellation message; dark theme renders correctly after its transition and survives reload.

## Remaining limits and follow-up

- Physical camera, torch, microphone, barcode recognition and native share/download behavior require real-device checks. The camera failure and scanner integration were checked in source; no hardware-success claim is made.
- Public anonymous MantleDB namespace writes remain the inherited sync architecture. Device IDs are not user authentication. Sensitive health data needs a separately designed authenticated backend and access rules before this can be represented as private secure cloud storage.
- Browser/local storage can be cleared or denied; fallback keeps the current tab usable but cannot promise persistence after it closes. Cloud writes remain best-effort; no durable background retry queue was added.
- AI nutrition and app scores are estimates, and database records are community supplied. No medical-validity claim, source accuracy certification or WCAG certification is made.
- Profile target calculations and AI guidance retain the existing nutrition logic. Professional validation of age/sex/medical-condition suitability is outside this UI/code audit.
- Installability and offline shell still depend on successfully cached external font/chart resources and existing manifest artwork; a first visit needs a connection.

## Delivery gate

### Modern analysis and report iteration

- Twelve automated tests pass, including macro shares from supplied grams, analysis basis labels, missing-day weekly averages, and escaping structured/fallback AI reports.
- Live Open Food Facts lookup for Quaker Oats rendered the prominent energy tile, labeled macro values, source badge and per-100 g basis.
- A live weekly report generated structured summary, observations and three next steps from a fictional one-entry diary. The sparse fixture exposed an inappropriate comparison with a daily target; the report prompt now explicitly treats logged days as potentially incomplete and prohibits inferring a deficit from partial logs.
- Report loading, empty and provider-format fallback states remain available. Shared result cards use the same Ascent palette.

Functional and regression checks pass for the verified flows. Core UI is responsive and keyboard dialogs have been exercised. Real-device features and anonymous cloud security are explicit remaining gates, not silently marked complete.
