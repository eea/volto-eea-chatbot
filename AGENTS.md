# Project Overview: Volto Chatbot

This project is a Volto add-on designed to integrate an AI-powered chatbot
into a Volto
(React-based frontend for Plone) project. It provides a customizable
interface and advanced
settings to tailor the chatbot's behavior and enhance user interactions. The chatbot
integrates with the Onyx service for its AI capabilities.

**Key Technologies:**

- **Frontend:** React, Volto (Plone frontend framework)
- **Backend Integration:** Onyx service
- **Development Tools:** Node.js, Cypress (E2E testing), Jest (unit testing),
  ESLint (linting), Prettier (code formatting), Stylelint (CSS linting).

### Integrating into an Existing Volto Project

1.  **Ensure Plone Backend is Running:** Make sure you have a Plone backend up
    and running, typically at `http://localhost:8080/Plone`. You can start it
    with Docker:

    ```bash
    docker compose up backend
    ```

2.  **Update `package.json`:** In your Volto project's `package.json`,
    add `@eeacms/volto-eea-chatbot` to the `addons` array
    and `dependencies`:

    ```json
    "addons": [
        "@eeacms/volto-eea-chatbot"
    ],
    "dependencies": {
        "@eeacms/volto-eea-chatbot": "*"
    }
    ```

3.  **Install and Start:**

    ```bash
    yarn install
    yarn start
    ```

### Environment Configuration

The project requires specific environment variables for Onyx service
authentication. Create a `.env` file in your project root with the following content:

```env
ONYX_URL=https://api.onyx.com
```

- `ONYX_URL`: The base URL of the Onyx service.

## Development Conventions

The project adheres to several development conventions to maintain code quality
and consistency.

- **Linting:**
  - Run ESLint checks: `make lint`
- Fix ESLint issues automatically: `make lint-fix`
- **Code Formatting:**
  - Check code formatting with Prettier: `make prettier`
  - Fix formatting issues automatically: `make prettier-fix`
- **Styling (CSS/LESS):**
  - Run Stylelint checks: `make stylelint`
  - Fix Stylelint issues automatically: `make stylelint-fix`
- **Testing:**
  - Run unit tests (likely Jest): `make test`
  - Update snapshots for tests: `make test-update`
  - Run Cypress end-to-end tests in headless mode: `make cypress-run`
  - Open Cypress test runner: `make cypress-open`
  - **Specific test file:** To test the addon, run
    `make addon-test TEST_FILE=src/addons/volto-eea-chatbot/src`. To test a specific file,
    for example `preprocessing.test.js`, run
    `make addon-test TEST_FILE=src/addons/volto-eea-chatbot/src/halloumi/preprocessing.test.js`
- **Pre-commit Hook:** A `pre-commit` hook is configured to automatically run
  `stylelint:fix`, `prettier:fix`, and `lint:fix` before each commit.
- **Internationalization:** Generate translation files: `make i18n`
- **Git Workflow:** When committing changes, always use `git status` to review
  changes and then `git add <relevant files changed>` to stage specific files,
  instead of `git add .`.

For more detailed contribution guidelines, refer to `DEVELOP.md`.
For release procedures, refer to `RELEASE.md`.

---

## Frontend Development Guide for AI Assistants

### EEA Design System Tokens

The EEA Design System provides shared LESS tokens for colors, spacing, typography, borders, and shapes. These are available via `@eeacms/volto-design-tokens`.

**Importing tokens:**

```less
@import '@eeacms/volto-design-tokens/src/colors';  // @blue-6, @grey-0, @green-4, etc.
@import '@eeacms/volto-design-tokens/src/shapes';  // @radius-1, @radius-3, @radius-round
@import '@eeacms/volto-design-tokens/src/borders'; // @border-size-1, @border-size-2
@import '@eeacms/volto-design-tokens/src/fonts';   // @font-size-0, @font-weight-6, @font-lineheight-2
```

**Pitfall:** Do NOT import `@eeacms/volto-design-tokens/src/sizes` directly — it references `@1px` which is a Semantic UI variable not available in standalone LESS. Instead, inline the spacing tokens you need:

```less
// Spacing tokens (from sizes.less, inlined to avoid @1px dependency)
@spacer: 4px;
@space-05: @spacer * 0.5;  // 2px
@space-1: @spacer * 1;     // 4px
@space-2: @spacer * 2;     // 8px
@space-3: @spacer * 3;     // 12px
@space-4: @spacer * 4;     // 16px
@space-5: @spacer * 5;     // 20px
@space-6: @spacer * 6;     // 24px
@space-8: @spacer * 8;     // 32px
```

**When adding new LESS files that use design tokens, ensure `@eeacms/volto-design-tokens` is listed in `package.json` dependencies:**

```json
"dependencies": {
  "@eeacms/volto-design-tokens": "*"
}
```

### Rendering Slate (Rich Text) Content

Volto stores rich text as Slate JSON. To render it in view components, use `serializeNodes`:

```jsx
import { serializeNodes } from '@plone/volto-slate/editor/render';

// In your component:
{someSlateContent && serializeNodes(someSlateContent)}
```

**Do NOT use `SlateViewer` from `@plone/volto/components`** — it does not exist. The `serializeNodes` function is the correct approach (used internally by the ChatBlock's `AIMessage.tsx`).

### Volto Block Registration Pattern

When creating a new Volto block:

1. **Schema function** accepts `{ intl, data }` and returns a schema object:
```jsx
export function MyBlockSchema({ intl, data }) {
  return {
    title: intl.formatMessage({ id: 'My Block', defaultMessage: 'My Block' }),
    fieldsets: [{ id: 'default', title: 'Default', fields: ['myField'] }],
    properties: { /* ... */ },
    required: [],
  };
}
```

2. **Edit component** must inject `intl` via `useIntl` and pass it to the schema:
```jsx
import { useIntl } from 'react-intl';

const MyBlockEdit = (props) => {
  const intl = useIntl();
  const schema = React.useMemo(
    () => MyBlockSchema({ intl, data: props.data }),
    [props.data, intl],
  );
  // ... render with BlockDataForm
};
```

3. **Block registration** in `index.js`:
```js
export default function installMyBlock(config) {
  config.blocks.blocksConfig.myBlock = {
    id: 'myBlock',
    title: 'My Block',
    icon: someSVG,
    group: 'common',
    view: MyBlockView,
    edit: MyBlockEdit,
    schema: MyBlockSchema,
    // ...
  };
  return config;
}
```

4. **Wire into `src/index.js`**: `installMyBlock(config);`

### Internationalization (i18n)

**All user-facing strings MUST use `react-intl`:**

```jsx
import { FormattedMessage, defineMessages } from 'react-intl';

// In JSX:
<FormattedMessage id="Hello world" defaultMessage="Hello world" />

// For message definitions (e.g., in messages.js):
export default defineMessages({
  greeting: { id: 'Hello world', defaultMessage: 'Hello world' },
});
```

After adding new strings, run `make i18n` to extract them into PO files.

### Semantic UI Toggle Checkboxes

**Avoid using Semantic UI `<Checkbox toggle>` for custom-styled toggles.** The toggle's internal DOM structure (`.box`, `label:before`) is difficult to style reliably across different background colors, and the default styles often clash with custom themes.

**Preferred approach:** Use a pure CSS toggle with a hidden `<input type="checkbox">`:

```jsx
<label className="my-toggle">
  <input type="checkbox" checked={enabled} onChange={(e) => onChange(e.target.checked)} />
  <span className="my-toggle-slider" />
  Label text
</label>
```

```less
.my-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;

  input { display: none; }

  .my-toggle-slider {
    position: relative;
    width: 28px;
    height: 16px;
    border: 1px solid currentColor;
    border-radius: 1rem;
    background-color: rgba(currentColor, 0.15);

    &::before {
      position: absolute;
      top: 1px;
      left: 2px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background-color: currentColor;
      content: '';
      transition: left 0.2s;
    }
  }

  input:checked ~ .my-toggle-slider {
    background-color: @green-4;
    border-color: @green-4;

    &::before { left: 13px; }
  }
}
```

### LESS Styling Conventions

- **Property ordering:** Stylelint enforces alphabetical property order. Run `make stylelint-fix` to auto-fix.
- **`:global()` usage:** Use `:global()` in LESS nesting to target Semantic UI or Volto classes without the parent selector prefix:
```less
.my-component {
  :global(.ui.button) { color: red; }
}
// Produces: .my-component .ui.button { color: red; }
```

### Testing Patterns

**Mocking common dependencies in Jest tests:**

```js
// react-intl
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ defaultMessage }) => defaultMessage }),
  FormattedMessage: ({ defaultMessage }) => <span>{defaultMessage}</span>,
}));

// react-router-dom (Volto uses v5)
const mockHistory = { push: jest.fn(), replace: jest.fn() };
jest.mock('react-router-dom', () => ({ useHistory: () => mockHistory }));

// Volto components
jest.mock('@plone/volto/components/manage/Sidebar/SidebarPortal', () => ({
  __esModule: true,
  default: ({ selected, children }) =>
    selected ? <div>{children}</div> : null,
}));
```

### Internal Import Paths

Use `@eeacms/volto-eea-chatbot/...` for internal imports (matches the Jest `moduleNameMapper`):

```js
import SVGIcon from '@eeacms/volto-eea-chatbot/ChatBlock/components/Icon';
import SendIcon from '@eeacms/volto-eea-chatbot/icons/send.svg';
```

### Matomo Tracking

Use `trackEvent` from `@eeacms/volto-matomo/utils` for analytics:

```js
import { trackEvent } from '@eeacms/volto-matomo/utils';

trackEvent({
  category: 'Chatbot',
  action: 'Some action',
  name: 'Some name',
});
```
