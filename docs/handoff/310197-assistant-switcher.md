# Handoff — assistant switcher (#310197)

Written after the feature was brought to a working state and then judged too
entangled to keep patching. The point of this document is that the next session
does not have to rediscover anything below, and can rebuild the feature with a
clearer shape.

- Branch: `feat/310197-assistant-switcher` (base `improvments` @ `7f913bb`)
- PR: https://github.com/eea/volto-eea-chatbot/pull/53
- Addon: `src/addons/volto-eea-chatbot` (its own git repo inside the frontend repo)
- Ticket: #310197, parent #310194. Payment ref `eaudeweb-AIHUB-GenAI-3322/B2026/EEA.61316`
- Spec written earlier in this branch: `docs/spec/310197-assistant-switcher.md`

## What the feature is meant to do

Editors configure a default assistant per chatbot block, plus a list of
additional assistants. When that list is non-empty, a drop-down appears in the
chat composer, left of the send button; picking another assistant rebinds the
conversation to it without leaving the page. Title, description, starter
prompts, tool list and analytics attribution follow the chosen assistant. A URL
parameter `?assistant=<id>` opens the block on a specific assistant when the
editor made it available.

## Hard facts about Onyx (the expensive knowledge)

Read from the Onyx checkout at `~/Work/onyx` (`01793f4d2`). Line numbers are from
that commit; symbols matter more than numbers.

1. **A chat session belongs to exactly one persona and cannot be re-pointed.**
   Proven experimentally, not just from the schema: sending
   `alternate_assistant_id` on `send-chat-message` changes neither the system
   prompt nor the retrieval, in either direction, with passing controls. A
   session's `persona_id`/`persona_name` never change. **Consequence: switching
   assistant requires a new session.**
2. **`additional_context` is ephemeral.** It is documented as *"Extra context
   prepended to the LLM's chat history, not stored in the DB"*
   (`onyx/chat/process_message.py`, `send_message` docstring), there is **no
   column** for it on `chat_session` or `chat_message` (`onyx/db/models.py`),
   and nothing serialises it back to the client. It becomes **one synthetic
   USER message per request**, inserted immediately before the newest user
   message (`onyx/chat/chat_utils.py`, `convert_chat_history`), wrapping the
   text in `ADDITIONAL_CONTEXT_PROMPT` (`onyx/prompts/chat_prompts.py`), and it
   is counted with `token_counter(additional_context)`.
   **Consequence: a client that wants the model to keep seeing that context
   must re-send it on every turn.** It is not duplicated — previous turns' copies
   are never in stored history.
3. **Budget trimming favours the newest messages and fails silently.**
   `onyx/chat/llm_loop.py` walks the history before the newest user message from
   newest to oldest and `break`s on the first message that does not fit. So an
   oversized `additional_context` wins the budget and older *real* messages are
   dropped; if the context alone does not fit, it is dropped too, with no error.
   The only hard failure is a `ValueError` when the newest user message itself
   does not fit.
4. **`allowed_tool_ids: []` means "no tools"** (`onyx/tools/tool_constructor.py`,
   the filter guard is `is not None`), with two exceptions: `MemoryTool` is always
   added when the user has it enabled, and `SearchTool` is force-added when search
   usage is `ENABLED`.
5. **There is no generic API to insert message rows.** The only seeding endpoint
   is `POST /chat/seed-chat-session-from-slack`, which takes only a session id and
   copies from a Slack thread store. `duplicate_chat_session_for_user_from_slack`
   (`onyx/db/chat.py`) is the pattern a real fork endpoint would follow.
6. **`ChatSession.user_id` exists in the DB**, but the API payload the middleware
   sees carries no `user_id`; `ChatSessionDetailResponse` exposes `owner_name` only.
7. **Every session on the site belongs to the same Onyx account**, because the
   middleware authenticates with one API key for all visitors. **Consequence:
   ownership comparisons are meaningless here.** Do not build them, and do not
   present a UUID-plus-service-key model as anything but "knowing the id is the
   permission". An owner check was added and then removed from this branch for
   exactly this reason (`0a4085a`).
8. **Chat sessions are deleted by TTL** (`backend/ee/onyx/background/celery/tasks/
   ttl_management/tasks.py`), so any chain of sessions can lose its ancestors over
   time.
9. **The persona list endpoint is not usable for the selector**: it returns only
   listed/public personas, its item cap is unproven (20 in the dev instance), and
   the block's default assistant must keep resolving as it does today. Per-id
   `GET /persona/{id}` is allow-listed and returns everything the UI needs.

## Decisions taken on this branch, and why

| Decision | Reason |
|---|---|
| Fork a new session on switch, lazily at the next submit | Sessions are persona-bound; lazy means exploring the drop-down creates no empty sessions |
| The block's initial persona fetch is keyed on the **resolved** id (`?assistant=` when offered, else the default) | The presentation (and its `?query=` auto-submit) must not exist before the active persona is known. A deferred variant sent the question to the default assistant — this was a real bug that reached review |
| Remaining assistants load **deferred**, no list endpoint | Keeps first paint identical to today; avoids the list endpoint's filtering and cap |
| Prior conversation handed over as `additional_context`, re-sent every turn, capped at **32000 chars** | It is the only mechanism without an upstream Onyx change; the cap bounds a payload that is re-sent and that competes with real history |
| Tools re-derived on switch as a **pure intersection** (plus internal search when offered) | A switch must never enable a capability the visitor did not ask for |
| Sharing walks the `[parent:]` tags server-side and publishes oldest-first, tail last | The shared reader only stitches *public* ancestors, so publishing only the tail showed just the last assistant's part |
| Drop-down hidden with fewer than two assistants; shown in shared view, disabled in editor preview and while streaming | One assistant is not a choice; a shared view is where you most want to switch |

## What is still fragile or unproven

- **Silent context loss.** The 32k cap drops the oldest turns; a warning is now
  shown (`chat-context-warning`), but the *model* losing the start of a
  conversation is still a soft failure. Onyx's own trimming can also evict the
  context or the real history under pressure, silently.
- **The share walk has never run against a live backend.** The model gateway was
  down for the whole session (every call timed out at ~60 s), so only unit tests
  cover it. The reader side *was* verified by hand: with a parent session public,
  a shared child returned 6 messages across two sessions.
- **Sharing has no ownership check and cannot have one** (fact 7). Following the
  tags means the middleware publishes sessions the person pressing the button
  cannot see. On this deployment that only matters in edge states (e.g. a
  `partial` share that later becomes completable), but it is the kind of design
  that should be replaced rather than defended.
- **Reload loses the conversation.** The transcript lives in React state only;
  a reload without `?chat=` starts over.
- **No per-message persona attribution anywhere** — not in the DB, the UI, the
  export or the shared view. A three-assistant transcript reads as if one
  assistant said everything, and exports label every answer with whichever
  assistant is active at export time.
- **Chain length is unbounded on the write side**, bounded at 10 on read/share.
  Beyond that, shared views silently start mid-conversation.
- **`?assistant=` is an editorial bypass surface**: it is honoured only for
  offered assistants, but that rule is enforced client-side.
- **Tests do not pin everything claimed.** The one-session/one-send deep link is
  asserted at two separate seams, never end to end; the second fork turn's
  `parent_message_id` and the wire form of `allowed_tool_ids` after a switch have
  no assertion.

## Mistakes made here, so the rebuild does not repeat them

1. Deferring the *initial* persona load broke the `?query=` deep link (question
   sent to the default assistant). The initial persona must be resolved before
   the presentation mounts.
2. The auto-submit effect was gated on the *alternatives* loading rather than the
   active persona, with `[]` deps, so it never retried and silently dropped the
   question.
3. A test was written that encoded bug 2 ("does not auto-submit while the other
   assistants are still loading"). It passed while the feature was broken.
4. An owner check was added that could never fire (fact 7).
5. The context cap was chosen by intuition (8000 chars ≈ four exchanges) before
   anyone measured what a conversation looks like.
6. The first attempt at splitting the work into commits produced one commit with
   everything and five with only new files, because the index was already fully
   staged and the repo's `lint-staged` hook restages globbed files. Always assert
   `git diff --cached --name-only` equals the intended list before committing.

## Suggested shape for the rebuild

1. **One owner for the assistant selection.** A reducer with explicit states
   (`resolving → ready`), a single `select`/`adopt` action, and the fallback when
   a selected record never arrives handled as a state transition rather than an
   effect. Test it as a table, at one seam. The two review bugs above were both
   this tangle.
2. **Make the fork an explicit module**, not a branch inside `onSubmit`:
   `forkConversation({ from, to, transcript }) → { sessionId, contextTruncated }`,
   called by *both* triggers (shared continuation, assistant switch). The current
   code reuses the shared-continuation branch implicitly, which is why the two
   paths keep surprising each other.
3. **Give the transcript hand-over a typed result** — `{ text, truncated }` —
   instead of a string plus a magic marker prefix.
4. **Decide the durability question first.** If the product wants the conversation
   to survive a reload, the cheap end state is an upstream
   `fork_from_session_id` on `POST /chat/create-chat-session`: Onyx copies the
   messages server-side, the fork becomes self-contained, and *all* of the
   following disappear: `additional_context` re-sending, the cap, the
   `[parent:]` tag, the server-side share walk, ancestor stitching, the depth cap
   and the `partial` flag. That is a much smaller system than what this branch
   ended up with, and it is why I would open that conversation with the Onyx
   owners before rebuilding the frontend.
5. **If sharing stays client-driven**, publish a bounded list of session ids the
   browser holds (the ones it created in this tab), tail last. Do not let the
   server follow tags it finds in data, and do not pretend to check ownership.
6. **Keep the `[parent:]` tag only if chain stitching remains.** If the fork
   becomes self-contained, delete the convention rather than leaving it half-used.

## Open questions for the next session

1. Is a shared view that shows only the last assistant's part acceptable if the
   chain walk is dropped? (Today's pre-PR behaviour.)
2. Should `?assistant=` survive at all? It is useful for the global AI Search
   Input block, but it is also a client-side editorial bypass.
3. Does the product want per-message attribution (needs storage the API does not
   have today)?
4. What is the real context window per persona? Our client sends no
   `llm_override`, so the effective model is fixed and undocumented to us — the
   cap has no principled basis without this number.
5. Fork at switch time or at first submit? Lazy was chosen; it is why switching
   and switching back costs nothing, but it also means the fork's description
   carries a message preview rather than a clean title.

## Environment notes

- Tests, from the frontend root:
  `RAZZLE_JEST_CONFIG=src/addons/volto-eea-chatbot/jest-addon.config.js npx razzle test src/addons/volto-eea-chatbot/src --watchAll=false`.
  `yarn` is not installed in this environment.
- Gates: `npx eslint --max-warnings=0 'src/addons/volto-eea-chatbot/src/**/*.{js,jsx}'`,
  `npx prettier --single-quote --check 'src/addons/volto-eea-chatbot/src/**/*.{js,jsx,json,css,less,md}'`,
  `npx stylelint src/addons/volto-eea-chatbot/src/ChatBlock/style.less`.
- `.husky/pre-commit` runs `yarn lint-staged`, which cannot run here. The hook
  exits early when `CI` is set, so commits were made with `CI=1` and the gates
  above run by hand. The hook's config is glob-based `make lint-fix` /
  `make prettier-fix`, which restages files — a reason to always verify the
  staged set.
- `make i18n` produces no diff in this worktree (`build/messages` stays empty and
  the addon's `locales/volto.pot` is already missing dozens of older strings).
  New strings use the standard `id` + `defaultMessage` form.
- `gh` is only authenticated through `with-secrets --`; PRs target
  `eea/volto-eea-chatbot`.
- The deployed Onyx (`aihub-latest.01dev.eea.europa.eu`) is reachable only through
  the Volto dev proxy on `:3000`, which holds the API key in `.env`. Never read
  that file; probe through the proxy.
