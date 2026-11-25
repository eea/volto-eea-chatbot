# Spec — Drop-down to switch between configured Assistants (#310197)

Parent feature: #310194. Ticket: https://taskman.eionet.europa.eu/issues/310197
Payment ref: `eaudeweb-AIHUB-GenAI-3322/B2026/EEA.61316`

Vocabulary: an **assistant** is what editors configure on the chatbot block (the UI term). A **persona** is the Onyx record behind it (`/_da/persona/{id}`), carrying the system prompt, knowledge sources and tools. A **chat session** is the Onyx conversation bound to exactly one `persona_id` at creation and immutable thereafter. The **available set** is the resolved default assistant plus the configured switchable assistants. The **active assistant** is the one the visitor is currently talking to.

## Problem Statement

A chatbot block is pinned to a single assistant at authoring time. A visitor who lands on an assistant that cannot answer their question has no route forward: they must find a different assistant's page, navigate away, lose the conversation they were having, and start again from scratch. Editors who know that two or three assistants cover related ground have no way to expose that without building and maintaining separate pages.

The global ask-ai search box makes this worse: it can send a visitor to a chatbot with a query, but never to a specific assistant, so the destination depends entirely on which block the editor happened to configure.

## Solution

Editors can configure a set of additional assistants on the block, next to the existing default assistant. When that set is non-empty, a drop-down appears in the composer toolbar, immediately left of the send button, listing the default assistant first and the configured ones after it. Selecting one rebinds the conversation to that assistant: title, description, assistant-provided prompts, available tools and analytics attribution all follow, while the conversation is carried over as context — the visitor keeps every message and continues in a new session belonging to the newly chosen assistant.

When the set is left empty the block behaves exactly as it does today: one assistant, no drop-down, one persona request on load.

A chatbot reached with an `?assistant=<id>` query parameter — from the global ask-ai search box or any deep link — opens on that assistant instead of the configured default, provided the id is one the editor made available. The drop-down remains the property of the chatbot; the ask-ai block itself is unchanged and targets an assistant by carrying the parameter on its existing endpoint setting.

## User Stories

1. As a site editor, I want to select additional assistants on the chatbot block, so that visitors can move between related assistants without leaving the page.
2. As a site editor, I want an empty additional-assistants list to keep the current single-assistant behaviour, so that existing blocks are unaffected and I opt in deliberately.
3. As a site editor, I want the default assistant to always be one of the visitor-facing choices, so that a visitor who switches away can always come back.
4. As a site editor, I want the order of the assistants in the drop-down to follow the order I configured, so that the most relevant alternatives appear first.
5. As a site editor, I want the default assistant pinned to the top of the drop-down, so that the list has a stable anchor.
6. As a site editor, I want to configure this without a separate feature flag, so that there is one decision to make instead of two.
7. As a site editor, I want the sidebar field to say that the default assistant is always offered, so that I do not waste time trying to exclude it.
8. As a site editor, I want to only pick assistants that exist, so that I cannot configure a dead reference.
9. As a site editor, I want the exposed-tools and default-tools choices to cover the tools of every assistant I allow switching to, so that a switchable assistant's tools can actually be offered to visitors.
10. As a visitor, I want to see which assistant I am currently talking to, so that I understand who is answering.
11. As a visitor, I want the assistant drop-down next to the send button, so that switching is reachable from where I type.
12. As a visitor, I want the drop-down on the landing state as well as mid-conversation, so that I can choose before asking the first question.
13. As a visitor, I want to see assistant names in the drop-down, so that I can tell them apart.
14. As a visitor, I want the name of my current assistant visible in the trigger itself, so that the composer always answers "who am I talking to".
15. As a visitor, I want the open menu to mark the active option, so that I can see what is selected.
16. As a visitor, I want the drop-down disabled while a response is streaming, so that I cannot switch mid-answer and get a reply from an assistant I did not choose.
17. As a visitor, I want the choice applied without a page navigation, so that I do not lose my place or my draft question.
18. As a visitor, I want my existing conversation to remain visible after switching, so that the context of what I asked is not thrown away.
19. As a visitor, I want the assistant I switched to to receive my prior conversation as context, so that follow-ups make sense without repeating myself.
20. As a visitor, I want the earlier turns to remain as they were, so that the history stays truthful about who said what.
21. As a visitor, I want exploring the drop-down before asking anything to leave no trace and create no session, so that curiosity costs nothing.
22. As a visitor, I want switching away and back *before sending anything* to need no new session, so that indecision is free.
23. As a visitor, I understand that switching back *after* sending starts a new session for that assistant with the conversation so far as context, because each session belongs to one assistant.
24. As a visitor, I want the landing title and description to follow the newly chosen assistant, so that the page reads coherently.
25. As a visitor, I want assistant-provided prompts to follow the newly chosen assistant, so that suggestions match who is answering.
26. As a visitor, I want generated seed questions to stay as they are when I switch, so that the landing state does not churn while I explore.
27. As a visitor, I want the tools drop-down to show only the tools the newly chosen assistant offers, so that I am never offered something that cannot work.
28. As a visitor, I want a tool that was active before and is unavailable on the new assistant to be dropped from my request, so that the assistant is never asked to use a tool it does not own.
29. As a visitor, I want a tool that was *not* active before to stay inactive after switching even if the new assistant has it, so that switching never silently enables capabilities I did not ask for.
30. As a visitor, I want internal search to stay active whenever the new assistant offers it, so that ordinary questions keep working after a switch.
31. As a visitor, I want my deliberate tool selections to carry over for tools both assistants share, so that switching does not reset my choices.
32. As a visitor, I want a pending forced-tool request dropped when the new assistant lacks that tool, so that the request cannot fail.
33. As a visitor arriving from the global ask-ai box, I want the chatbot to open on the assistant the link names, so that I land where the link intended — and the question I typed goes to that assistant, not the default.
34. As a visitor, I want a link naming an assistant the editor did not make available to be ignored in favour of the configured default, so that links cannot bypass an editorial restriction.
35. As a visitor opening a shared conversation, I want it rendered with the assistant that actually answered, so that the shared artifact is truthful.
36. As a visitor opening a shared conversation, I want the drop-down available so that I can continue with a different assistant instead of being blocked.
37. As a visitor continuing a shared conversation with a different assistant, I want the new session to descend from the shared one, so that a later share of my continuation includes what was said before.
38. As a visitor, I want the assistant I picked used for the rest of the conversation, so that I do not re-pick on every message.
39. As a visitor, I want the drop-down reachable by keyboard and screen reader, so that the feature is not mouse-only.
40. As a visitor, I want the menu to close on Escape and outside click, so that it behaves like the other menus on the page.
41. As a visitor, I want focus back in the textarea after choosing, so that I can keep typing immediately.
42. As a visitor, I want long assistant names truncated rather than pushing the send button off the composer, so that the layout stays usable.
43. As a visitor, I want the drop-down absent in editor preview, so that it does not interfere with authoring.
44. As a visitor, I want a misconfigured, since-deleted switchable assistant to be silently missing rather than breaking the block, so that the rest keeps working.
45. As a visitor, I want a failed switch to keep my typed question in the composer and tell me something went wrong, so that I do not lose what I wrote.
46. As an analytics owner, I want each event to name the assistant actually in use, so that switching does not misattribute engagement.
47. As an analytics owner, I want a dedicated event for switching, so that I can see whether the feature is used and which transitions happen.
48. As a visitor sharing a multi-assistant conversation, I want the shared view to show the whole conversation, so that the recipient sees what I see — including after I reload the page before sharing.
49. As a visitor sharing, I want a failure to be visible instead of silently producing a link, so that I never hand out a link that shows less than I intend.
50. As a visitor exporting a multi-assistant conversation, I want every message in the export, so that the artifact is complete.
51. As a developer, I want the unused-feature path to stay byte-identical — one request, same dependency, same first paint — so that the change carries no regression risk for current blocks.
52. As a developer, I want the block to make no persona-list request, so that the feature does not depend on that endpoint's filtering or item cap.
53. As a developer, I want the active assistant resolved *before* the composer exists, so that the URL-triggered auto-submit can never reach the wrong assistant.
54. As a developer, I want the switch to be a pure client-side state change, so that the interaction has no latency.
55. As a developer, I want the session-bound persona tracked explicitly, so that a persona change can never silently continue an incompatible session.
56. As a developer, I want the persona fork to reuse the existing shared-continuation branch rather than duplicate it, so that there is one implementation of "new session, prior conversation as context".
57. As a developer, I want tests asserting wire-level facts — the session's `persona_id`, the description tag, `additional_context`, `allowed_tool_ids` — so that a regression cannot look correct in the UI while talking to the wrong assistant.
58. As a developer, I want new strings extracted for translation, so that the feature ships localized.
59. As a developer, I want the README functionalities table updated, so that editors discover the setting.
60. As a developer, I want the known attribution asymmetries documented, so that the next reader does not treat them as bugs.
61. As a visitor arriving from a deep link, I want the address bar to lose only my question after it has been sent, so that reloading keeps me on the same assistant with the same settings.

## Implementation Decisions

**Configuration surface.** The block gains one field, a multi-select of assistants, directly after the default-assistant dropdown in the default fieldset, defaulting to an empty list. Presence of entries is the feature switch; no separate boolean. The default assistant is always included in the visitor-facing list and pinned first even if not selected; the rest follow the editor's selection order. Stored values are assistant ids only — names are not persisted, since every persona record is fetched anyway and a stored name would drift from Onyx.

**Tool choices follow the available set.** The exposed-tools and default-tools choices are computed from the union of the default assistant and every switchable assistant, not from the default alone. Without this, a switchable assistant's tools could never be listed as exposed, which would silently strip its toolset from visitors.

**Persona loading, and why it is not deferred for the initial pick.** The block resolves the *initial* assistant before anything else: `?assistant=` when it names an id in the available set, otherwise the configured default. The blocking persona fetch is keyed on that resolved id, so the existing load-until-resolved behaviour guarantees an invariant: **no composer exists until the active persona is known**, and therefore the URL-triggered auto-submit can never be sent to the wrong assistant. This is also what makes the feature compatible with the existing URL-driven auto-submit, which is a separate, unchanged feature: the presentation auto-submits a `?query=` value once on mount, so any design that renders the composer before the requested assistant is known would send that question to the default assistant and bind the session to it, then fork and ask again when the requested persona arrived. Resolving the initial persona before render makes that sequence unreachable without touching the auto-submit. The remaining available assistants are fetched in parallel as deferred data; that fetch never gates rendering, and the selector stays out of the DOM until it settles, so the menu never changes shape under the pointer. Failed switchable fetches are logged and that assistant is dropped; a failed initial fetch behaves exactly like a failed default fetch does today (block shows its placeholder). The persona-list endpoint is deliberately unused: it is filtered to listed/public personas and its item cap is unproven, and the block's initial persona must keep resolving as it does today. Deferred fetching lives in a dedicated loader hook; the existing data-loading higher-order component keeps its single "block until resolved" contract and is not extended. In editor preview the loader does not run at all.

**Id types.** Ids are compared and looked up as strings (widget values and query parameters are strings, persona records carry numbers). Ids on the wire keep the type the persona record carries: `persona_id` and `allowed_tool_ids` remain numeric.

**Active assistant ownership.** The block view resolves the initial assistant id and receives the resolved persona set; the presentation owns the active assistant id as state and derives the active persona from it. `persona` keeps its established meaning for presentation variations but now denotes the **active** persona, and the set plus initial id are added to the documented variation contract. A variation that does not render the selector keeps working and stays pinned to the resolved initial assistant — the feature is additive, never required. The choice is not persisted across visits; it lives and dies with the mounted block.

**Precedence with shared conversations.** When a shared conversation is opened, the persona recorded on that session is adopted as the active assistant if it is in the available set, taking precedence over `?assistant=`; if it is not in the available set the default is used and the drop-down remains enabled. Effective precedence: shared session persona, then `?assistant=`, then the configured default. Adopting the recorded persona is a correctness requirement, not a cosmetic one: the first follow-up otherwise forks into the wrong assistant.

**Session semantics.** Switching is a lazy fork. The controller records which persona the live session was created with. On submit, if the session was created with a different persona, a new session is created for the active persona and the prior conversation is flattened into `additional_context`; if no session exists yet (switched before asking anything) a plain session is created with no parent; if the persona matches the live session — including switching away and back with nothing sent — no fork happens. Nothing is created at switch time, so exploring the menu leaves no empty sessions. Returning to an earlier assistant *after sending* always forks, because each session belongs to one assistant and the shared-conversation reader follows a linear parent chain, not a tree. The persona fork reuses the existing shared-continuation branch verbatim, including the parts that make the second turn correct: the inherited-context ref, the forked-node set, `parent_message_id` forced null on the fork turn, and the shared-parent marker cleared. The inherited context continues to be re-sent on every turn of the forked session, matching the existing behaviour rather than introducing a second, subtly different policy.

**Prior conversation payload.** The flattened transcript is built from the local transcript at each fork (never accumulated across forks): `user` and `assistant` messages only, each rendered as `User: <text>` or `Assistant: <text>`, joined by a blank line, quoting the answer text only and not citations or source lists, and excluding any exchange that ended in an error. It is truncated to the most recent 8000 characters at a message boundary and prefixed with a marker line when truncation occurred.

**Fork failure.** A failed session creation happens before any message is appended, so nothing is lost from the transcript — but the composer currently clears its text on submit. Submit therefore returns whether it was accepted, and the composer clears only on acceptance. A rejected submit keeps the draft and surfaces an inline error. Once a session exists, message-level failures keep their current behaviour.

**Session chain and sharing.** Each forked session's description ends with the established terminal `[parent:<previous session uuid>]` tag (the recogniser is end-anchored). The client does not track the chain: the share endpoint walks it server-side, reading each session's description, publishing ancestors oldest-first and the newest session **last**, up to the same depth cap the shared-conversation reader uses. Publishing last is deliberate — a failure leaves the newest session private, so no link can exist that points at a partially published chain. Ancestors that are already public are not re-published. This is the only backend change and it makes sharing reload-safe, since a reloaded page cannot know the chain from the sanitised shared-conversation payload.

The trust model is inherited from the endpoint this replaces rather than invented here: a chat session UUID is a bearer capability, and the single-session share has always published whatever UUID it was given. Onyx exposes no owner on a session, so the tags cannot be verified against one; walking them grants nothing that posting the same UUID directly would not. Per-user sharing controls would need identity data the API does not return.

When an earlier session of the chain has been deleted or cannot be read, the readable part is still published and the response carries `partial`, which the toolbar shows as "some earlier messages could not be included" — a link that starts part-way is acceptable only when the visitor is told. Share failures are surfaced instead of swallowed, for every share and single-assistant included; that is a deliberate, listed behaviour change, separate from the unused-feature path.

**Tool selection on switch.** Available tools remain the intersection of the active persona's tools and the block's exposed-tool configuration. On a persona change the selection becomes the previous selection intersected with the new available set — no fallback to the new persona's defaults, because a fallback would auto-enable a tool nobody asked for. Internal search is identified by the tool's in-code identifier rather than by a hard-coded id, and stays active when either side offered it. A pending forced-tool request is dropped when the new persona lacks that tool. This matters because the request carries the selection as `allowed_tool_ids`: a dangling id would ask the assistant to use a tool it does not own. The `initialToolIds` fallback is preserved for the mount case and for configuration changes — it is suppressed only on persona change. An empty selection is sent as an empty list, as today.

**Not switchable.** `alternate_assistant_id` was measured against the deployed service and does not change a persona's system prompt or knowledge sources in either direction, with passing controls in both polarities; a session's persona id and name never change. Per-message persona routing is therefore unavailable and the fork is the mechanism, not a preference. Seed-question generation is keyed on the related-questions assistant and the block, not on the active persona, so generated seed questions are already stable across a switch and are left untouched. An in-flight related-questions fetch is neither cancelled nor retriggered by a switch; it is persona-independent and applied by node.

**URL handling on auto-submit.** The existing mount auto-submit clears the `query` parameter from the address bar so a reload does not re-ask. It currently clears every parameter; it must clear `query` only and preserve the rest — `assistant`, `deepResearch`, `playwright`, and anything else present — so a deep link that names an assistant keeps naming it after the question is consumed. The remaining search string is rebuilt from the parsed parameters and the address replaced without a navigation; when nothing remains the search is dropped rather than left as a bare `?`. No other address-bar cleanup is touched.

**Observability and i18n.** Every category naming the assistant uses the active persona, so attribution follows what the visitor used. Switching emits its own event, categorised under the assistant being left and named after the assistant being entered, so transitions can be read from analytics. New strings go through the existing extraction so they ship translated.

**Documented asymmetries.** A shared or exported multi-assistant conversation is attributed to the last assistant in the chain, because a session's persona name is immutable. Export headers and analytics use whichever assistant is active at the moment of the action, not the one that produced each message. A `?assistant=` naming an id the block does not offer is ignored silently apart from a development warning, and the trigger shows the actual assistant, so the resulting state is visible rather than lying.

## Testing Decisions

Good tests assert externally observable behaviour: what the visitor sees and can do, and what leaves the browser towards the assistant service. They do not assert internal state names, effect ordering or component structure. The highest-value assertions are wire-level — the `persona_id` on a created session, the terminal parent tag, the `additional_context` payload, the `allowed_tool_ids` actually sent — because the failure mode this feature invites is a UI that looks switched while the wire still talks to the previous assistant.

The feature is covered at five existing seams and two new ones, all following established prior art:

- **Block view seam (existing).** Block data plus query parameters in; the resolved persona set and the initial selection out. Covers `?assistant=` honoured when offered, ignored when not, and the shared-session persona taking precedence. Prior art: the existing block view render test with its mock presentation.
- **Chat window render seam (existing).** Selector presence per configuration, absence in editor preview, presence in shared view, disabled while streaming, and that selecting an assistant updates title, description and assistant prompts with no further request. Prior art: the existing chat window suite. The tool-list assertion does **not** live here: this suite mocks the controller, so reading the tool list from it would pass even if the window passed a stale persona.
- **Chat controller hook seam (existing).** The correctness seam, with the real hook. Covers: fork on persona change creates a session with the new persona and a terminal parent tag; no tag when no session existed; switching away and back without sending reuses the session; available tools and the selection are re-derived for the new persona and never re-defaulted; the forced tool is pruned; `additional_context` carries the flattened transcript in the specified format and truncation; submit reports rejection on fork failure. Prior art: the existing controller tests with a mocked streaming service.
- **Block schema seam (existing).** The new field is multi-select with an empty default, sits in the default fieldset, and the tool choices cover the union of assistants. Prior art: the existing schema test.
- **Share endpoint seam (existing, backend).** Chain walking order, tail published last, already-public ancestors left alone, the `partial` flag when an ancestor is unreachable, abort on a failed publish, depth cap. Prior art: the existing middleware tests.
- **Two new unit seams**, unavoidable because both modules are new: the persona loader (no request when empty or in editor preview; one per id; duplicates and the initial id skipped; a single failure drops only that assistant; no refetch on re-render; nothing rendered while pending) and the selector component (options, active marking, keyboard and outside-click dismissal, disabled while streaming, no-op on the active entry). Prior art: the other hook tests and the tool-selector component test.

One cross-cutting case is asserted explicitly, because it is the likeliest regression and it spans three of these seams: a URL carrying both a query and an assistant creates exactly one session, for the named assistant, sends the question exactly once, and leaves the address bar carrying the assistant but no longer the query.

No new production seam is introduced on the read path: no new endpoint and no new allow-listed route, since the per-id persona route is already permitted. The only backend change is inside the existing share route.

## Out of Scope

- Per-message assistant attribution in shared or exported conversations, and any change to a session's persona name.
- Switching assistants without forking a session (measured unavailable through `alternate_assistant_id`).
- Remembering the visitor's last chosen assistant across visits.
- A selector inside the global ask-ai block; it targets an assistant only by carrying `?assistant=` on its existing endpoint setting, and no field is added to it.
- Per-assistant tool configuration: exposed and default tools stay block-level and are re-evaluated against the active assistant.
- Changes to seed-question generation or caching.
- Restyling the composer or the existing tool and deep-research pills.
- Chains deeper than the reader's stitching cap: shared views truncate beyond it, documented rather than fixed.
- Unsharing a multi-assistant conversation.
- Per-user sharing controls: a session UUID is a bearer capability, and the API exposes no owner to check against.

## Further Notes

`?assistant=` is honoured only for assistants the editor made available. This is deliberately not a general override: the list is an editorial decision about which assistants a page offers, and a URL naming any persona would be a policy bypass.

Two questions were settled by measurement rather than assumption and are worth recording. The persona-list endpoint returns every field the chat interface reads, identical to the per-persona endpoint for those fields, so a single list request was technically viable — rejected only because the list is filtered to listed/public personas and its cap is unproven, which would couple the initial assistant to list filtering. And `alternate_assistant_id` produces no behavioural change in either direction on the deployed service, which is what makes the session fork the only available mechanism.

Deliberate behaviour changes beyond the new feature, both listed so they are not mistaken for regressions: share failures now surface instead of being swallowed, and a `?assistant=` naming an unoffered id is ignored rather than honoured.

Slices, each keeping the suite green: configuration and the persona loader; block-view resolution including query parameters and the shared-session persona; the selector and active-assistant wiring in the presentation; the session fork, prior-conversation payload and tool re-derivation (the correctness slice); the share endpoint chain walk; then documentation, translation extraction and a visual pass on desktop and narrow viewports.
