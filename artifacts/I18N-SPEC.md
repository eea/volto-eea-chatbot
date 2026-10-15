# i18n specification — volto-eea-chatbot

**Status: not implemented.** Written 2026-10-08 for a dedicated branch that handles
internationalisation across the whole add-on. Nothing here is urgent: no locale is
filled today, so every string already falls back to English.

Line numbers are from `develop` at the time of writing. Re-run §4's command to
regenerate the inventory before starting.

---

## 1. Current state (measured)

The Volto add-on i18n stack is present and wired:

| piece | location | state |
| --- | --- | --- |
| locale catalogues | `locales/{de,en,it,ro}/LC_MESSAGES/volto.po` | present, **empty** |
| template | `locales/volto.pot` | present, dated **2026-09-17** (stale) |
| extractor | `make i18n` → `node_modules/.bin/i18n --addon` | works, **manual** — no CI step |
| message definitions | `src/AISearchInput/messages.js` (`defineMessages`) | pattern to copy |
| consumption | `<FormattedMessage {...messages.x} />` | 48 call sites |

Coverage is the problem:

| measure | value |
| --- | --- |
| msgids in `volto.pot` | **11** — all from `AISearchInput` |
| msgstr filled, any locale | **0 of 10** in de, it, ro and en |
| intl call sites in `ChatBlock/` | **8** (ChatWindow 3, AIMessage 2, AutoResizeTextarea 2) |
| hardcoded English literals in `ChatBlock/` | **~40** (28 JSX/prop literals + ~12 in JS constants and utils) |
| fact-check UI strings extracted | **0** |

So the add-on is translatable in principle and English-only in practice. The
`en/volto.po` being empty is normal and should stay empty — `defaultMessage` is the
source of truth.

---

## 2. Target design

**One messages file per feature**, matching the existing pattern:

- `src/ChatBlock/messages.js` (new)
- `src/AISearchInput/messages.js` (exists, keep)

The extractor scans `src/**/messages.js`; keep that exact filename.

**Message ids are the English text** (Volto convention, already used in the `.pot`).
Do not invent key names for ids — `defaultMessage` carries the copy, `id` is the key.

**Components** use `<FormattedMessage {...messages.x} />`, or `useIntl().formatMessage(...)`
when the string must be a plain value (e.g. an `aria-label` prop, a `title` attribute).

**Pure helpers return message descriptors, not strings.** This is the decision that
matters for the fact-check UI: `ChatBlock/utils/index.tsx` maps a verdict to copy and
is unit-tested without any React or intl context. Returning descriptors keeps it that way.

```js
// src/ChatBlock/messages.js
import { defineMessages } from 'react-intl';

export default defineMessages({
  verdictSupportedHeader: {
    id: 'Supported by the sources',
    defaultMessage: 'Supported by the sources',
  },
  // …one entry per verdict
});
```

```js
// ChatBlock/utils/index.tsx — descriptor maps instead of string maps
import messages from '@eeacms/volto-eea-chatbot/ChatBlock/messages';

const VERDICT_HEADER = {
  supported: messages.verdictSupportedHeader,
  not_enough_info: messages.verdictNotConfirmedHeader,
  contradicted: messages.verdictContradictedHeader,
};

export function claimHeaderLabel(score, contextLimited = false) {
  if (contextLimited) return messages.verdictUnverifiedHeader;
  return VERDICT_HEADER[scoreToVerdict(score)];
}
```

```jsx
// ChatBlock/components/markdown/ClaimModal.jsx
<span className="claim-label">
  <FormattedMessage {...claimHeaderLabel(claim.score, claim.context_limited)} />
</span>
```

Tests then assert on the descriptor (`id` / `defaultMessage`) rather than on English
prose, so they stay intl-free.

**Plurals and counts move into ICU**, replacing JS string building. Today
`HalloumiFeedback` composes the banner sentence from a ternary and a template literal;
that cannot be translated into languages with more than two plural forms.

```js
// messages.js
partialContext: {
  id: '{count, plural, one {# claim was} other {# claims were}} checked against short excerpts, so “not confirmed” may mean missing text rather than a mistake.',
  defaultMessage:
    '{count, plural, one {# claim was} other {# claims were}} checked against short excerpts, so “not confirmed” may mean missing text rather than a mistake.',
},
```

```jsx
<MessageContent>
  <strong><FormattedMessage {...messages.partialContextLead} /></strong>{' '}
  <FormattedMessage {...messages.partialContext} values={{ count: limitedClaims.length }} />
</MessageContent>
```

---

## 3. What must not be extracted

- Answer content, source titles, chunk text — data, not UI copy.
- `${score}%`, `num_tokens`, and similar interpolations — data.
- The `claim-quote` block in `ClaimModal`, which is rendered through
  `dangerouslySetInnerHTML` from the answer itself.
- Log messages and `debug()` labels.
- Anything in `services/` or `hooks/` that is only compared or thrown internally —
  but see `VERIFY_CLAIM_MESSAGES` in `HalloumiFeedback.jsx:12-15`, which **is** shown
  to the user and must be extracted.

---

## 4. Inventory

Regenerate the candidate list with:

```bash
cd src && rg -n ">[A-Z“][^<>{}]{3,80}<|(placeholder|title|aria-label|alt|label)=\"?" \
  ChatBlock AISearchInput -g '!tests' | less
```

### A. Fact-check UI — 14 strings, added or touched 2026-10-08, zero extracted

| file | line | string |
| --- | --- | --- |
| `ChatBlock/utils/index.tsx` | 82–84 | `Supported by the sources` / `Not confirmed by the sources` / `Contradicted by the sources` |
| `ChatBlock/utils/index.tsx` | 88–90 | `Supported` / `Not confirmed` / `Contradicted` |
| `ChatBlock/utils/index.tsx` | 99 | `Couldn't be checked` |
| `ChatBlock/utils/index.tsx` | 104 | `Unverified` |
| `ChatBlock/components/markdown/ClaimModal.jsx` | 79 | `Fact check` |
| `ChatBlock/components/markdown/ClaimModal.jsx` | 96 | `Rationale` |
| `ChatBlock/components/HalloumiFeedback.jsx` | 136 | `Some sources could not be loaded in full.` |
| `ChatBlock/components/HalloumiFeedback.jsx` | 137–140 | banner sentence with claim count (→ ICU plural) |
| `ChatBlock/components/HalloumiFeedback.jsx` | 141 | `Every claim was still matched against the text that was available, so this did not change the result.` |
| `ChatBlock/components/markdown/ClaimSegments.jsx` | 139 | `Jump to Citation` |

### B. Fact-check UI — pre-existing

| file | line | string |
| --- | --- | --- |
| `ChatBlock/components/HalloumiFeedback.jsx` | 12–15 | `VERIFY_CLAIM_MESSAGES` (3 progress lines) |
| `ChatBlock/components/HalloumiFeedback.jsx` | 82 | `Please allow a few minutes for claim verification…` |
| `ChatBlock/components/HalloumiFeedback.jsx` | 89, 107 | `Fact-check AI answer`, `Retry Fact-check AI answer` |
| `ChatBlock/components/markdown/Citation.jsx` | 39 | `This doc doesn't have a link.` |
| `ChatBlock/chat/AIMessage.tsx` | 470, 700 | `See all sources`, `Sources` |

### C. Chat shell

| file | line | string |
| --- | --- | --- |
| `ChatBlock/ChatBlockView.jsx` | 45 | `Chatbot` |
| `ChatBlock/chat/ChatWindow.tsx` | 409 | `Deep research on` (partially done — 3 call sites exist) |
| `ChatBlock/chat/ChatMessage.tsx` | 26 | `Error` |
| `ChatBlock/components/FeedbackModal.jsx` | 116 | `Cancel` |
| `ChatBlock/components/RelatedQuestions.jsx` | 29 | `Related questions:` |
| `ChatBlock/packets/MultiToolRenderer.tsx` | 267 | `Done` |
| `ChatBlock/packets/renderers/FetchToolRenderer.tsx` | 35 | `Fetching Documents` |
| `ChatBlock/packets/renderers/ImageToolRenderer.tsx` | 38 | `Generated Images` |

### D. Accessibility strings — same priority as visible copy

`title` / `aria-label` / `alt` in `ChatMessageFeedback.jsx:39-40`,
`UserActionsToolbar.jsx:25-26`, `QualityCheckToggle.jsx:15`, `Source.jsx:23`,
`WebResultIcon.tsx:31`, `AIMessage.tsx:537`, `ChatWindow.tsx:223`. An untranslated
`aria-label` is a screen-reader defect, not a cosmetic gap.

---

## 5. Testing

- **Existing tests assert English prose.** `utils.test.jsx` (verdict labels),
  `ClaimModal.test.jsx` (header, badge, `data-verdict`), `HalloumiFeedback.test.jsx`
  (banner copy, pluralisation). With descriptors, assert `id`/`defaultMessage`
  instead. Do not wrap these tests in `IntlProvider` — that is the point of returning
  descriptors.
- **Component tests and snapshots** will churn: `ClaimModal.test.jsx.snap` and the
  HalloumiFeedback assertions contain the current English. Expect to re-run with `-u`.
- **Add a drift guard**: one test that every descriptor exported from
  `ChatBlock/messages.js` has a matching `id` in `locales/volto.pot`. Cheap, and it is
  the only thing that stops copy drifting away from the catalogue once translators
  are involved.
- Frontend suite command:
  `CI=true RAZZLE_JEST_CONFIG=src/addons/volto-eea-chatbot/jest-addon.config.js yarn test src/addons/volto-eea-chatbot/src --watchAll=false`

---

## 6. Workflow and CI

`make i18n` is manual and the `.pot` predates the fact-check work, so the catalogue is
already out of sync with the code. Add a CI step:

```bash
make i18n
git diff --exit-code locales/   # fails when a string was added without extracting
```

Translation fill (de/it/ro) is a separate, human task — the EEA translation workflow,
not a code task. Until it happens, English fallback applies and nothing changes for
users.

---

## 7. Suggested commit order

1. `src/ChatBlock/messages.js` + descriptors for the fact-check UI (§4A) and the
   components that render them. One reviewable commit, no behaviour change.
2. Banner pluralisation to ICU.
3. Pre-existing fact-check copy (§4B) and `ClaimSegments`.
4. Chat shell (§4C) and accessibility strings (§4D).
5. CI extraction check + regenerated `locales/`.

Each step keeps the suite green on its own; do not mix 1–4 with the `.pot` regeneration.

---

## 8. Gotchas

- **Do not key translations by English text at render time** (no
  `translate(labelMap[score])` lookup tables). Descriptors only.
- `utils/index.tsx` is imported by tests with no `IntlProvider` in scope. Descriptors
  preserve that; passing `intl` into the helpers would force a provider into every test.
- The extractor only sees `messages.js` files and literal `<FormattedMessage>` /
  `defineMessages` usage — computed or concatenated strings are invisible to it.
- Curly quotes in the banner (`“not confirmed”`) must survive extraction; the `.po`
  files are `charset=utf-8`, so this is fine, but do not let a formatter normalise them.
- `en/volto.po` stays empty on purpose.
- Volto core already translates generic words (`Cancel`, `Error`); check for an
  existing id before adding a duplicate.

---

## 9. Out of scope

- Translating answer text, source titles or chunk content — that is Onyx's corpus.
- Date/number localisation (`${score}%` formatting) — separate concern, and the
  percentage is verdict-derived, not a measurement.
- Filling the de/it/ro catalogues.
