import messages from './messages';

export function AISearchInputSchema({ intl, data }) {
  return {
    title: intl.formatMessage(messages.aiSearchInput),
    fieldsets: [
      {
        id: 'default',
        title: intl.formatMessage({
          id: 'Default',
          defaultMessage: 'Default',
        }),
        fields: [
          'assistantEndpoint',
          'blockTitle',
          'introText',
          'showIcon',
          'placeholderText',
          'examplePromptsEnabled',
          ...(data.examplePromptsEnabled ? ['examplePrompts'] : []),
          'deepResearch',
          'disclaimerText',
          'stylingVariant',
        ],
      },
    ],
    properties: {
      assistantEndpoint: {
        title: intl.formatMessage({
          id: 'Assistant page URL',
          defaultMessage: 'Assistant page URL',
        }),
        description: intl.formatMessage({
          id: 'URL of the Plone page that contains the AI Chatbot block (e.g. /ai-assistant).',
          defaultMessage:
            'URL of the Plone page that contains the AI Chatbot block (e.g. /ai-assistant).',
        }),
        widget: 'url',
        type: 'string',
      },
      blockTitle: {
        title: intl.formatMessage({
          id: 'Block title',
          defaultMessage: 'Block title',
        }),
        description: intl.formatMessage({
          id: 'Optional title displayed inline with the icon.',
          defaultMessage: 'Optional title displayed inline with the icon.',
        }),
        type: 'string',
      },
      introText: {
        title: intl.formatMessage({
          id: 'Introductory text',
          defaultMessage: 'Introductory text',
        }),
        description: intl.formatMessage({
          id: 'Help text shown next to the icon and title.',
          defaultMessage: 'Help text shown next to the icon and title.',
        }),
        widget: 'slate',
      },
      showIcon: {
        title: intl.formatMessage({
          id: 'Show icon',
          defaultMessage: 'Show icon',
        }),
        type: 'boolean',
        default: true,
      },
      placeholderText: {
        title: intl.formatMessage({
          id: 'Placeholder text',
          defaultMessage: 'Placeholder text',
        }),
        type: 'string',
        default: intl.formatMessage(messages.askYourQuestion),
      },
      examplePromptsEnabled: {
        title: intl.formatMessage({
          id: 'Show example prompts',
          defaultMessage: 'Show example prompts',
        }),
        type: 'boolean',
        default: false,
        description: intl.formatMessage({
          id: 'When enabled, editors can define clickable prompt chips below the input.',
          defaultMessage:
            'When enabled, editors can define clickable prompt chips below the input.',
        }),
      },
      examplePrompts: {
        title: intl.formatMessage({
          id: 'Example prompts',
          defaultMessage: 'Example prompts',
        }),
        widget: 'object_list',
        schema: {
          title: intl.formatMessage({
            id: 'Prompt',
            defaultMessage: 'Prompt',
          }),
          fieldsets: [
            {
              id: 'default',
              title: intl.formatMessage({
                id: 'Default',
                defaultMessage: 'Default',
              }),
              fields: ['label', 'message'],
            },
          ],
          properties: {
            label: {
              title: intl.formatMessage({
                id: 'Label',
                defaultMessage: 'Label',
              }),
              description: intl.formatMessage({
                id: 'Text displayed on the chip button.',
                defaultMessage: 'Text displayed on the chip button.',
              }),
            },
            message: {
              title: intl.formatMessage({
                id: 'Message',
                defaultMessage: 'Message',
              }),
              type: 'string',
              description: intl.formatMessage({
                id: 'Optional — the actual query sent when clicked. If empty, uses the label.',
                defaultMessage:
                  'Optional — the actual query sent when clicked. If empty, uses the label.',
              }),
            },
          },
          required: ['label'],
        },
      },
      deepResearch: {
        title: intl.formatMessage(messages.deepResearch),
        choices: [
          [
            'unavailable',
            intl.formatMessage({
              id: 'Unavailable',
              defaultMessage: 'Unavailable',
            }),
          ],
          [
            'always_on',
            intl.formatMessage({
              id: 'Always on',
              defaultMessage: 'Always on',
            }),
          ],
          [
            'user_on',
            intl.formatMessage({
              id: 'User choice, on by default',
              defaultMessage: 'User choice, on by default',
            }),
          ],
          [
            'user_off',
            intl.formatMessage({
              id: 'User choice, off by default',
              defaultMessage: 'User choice, off by default',
            }),
          ],
        ],
        default: 'unavailable',
      },
      disclaimerText: {
        title: intl.formatMessage({
          id: 'Disclaimer text',
          defaultMessage: 'Disclaimer text',
        }),
        widget: 'slate',
        description: intl.formatMessage({
          id: 'AI transparency text. Always displayed at the bottom of the block.',
          defaultMessage:
            'AI transparency text. Always displayed at the bottom of the block.',
        }),
        default: [
          {
            type: 'p',
            children: [
              { text: intl.formatMessage(messages.defaultDisclaimer) },
            ],
          },
        ],
      },
      stylingVariant: {
        title: intl.formatMessage({
          id: 'Styling variant',
          defaultMessage: 'Styling variant',
        }),
        choices: [
          ['dark', intl.formatMessage({ id: 'Dark', defaultMessage: 'Dark' })],
          [
            'light',
            intl.formatMessage({ id: 'Light', defaultMessage: 'Light' }),
          ],
          [
            'accent',
            intl.formatMessage({ id: 'Accent', defaultMessage: 'Accent' }),
          ],
        ],
        default: 'dark',
      },
    },
    required: ['assistantEndpoint'],
  };
}
