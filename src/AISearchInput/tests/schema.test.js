import '@testing-library/jest-dom';
import { AISearchInputSchema } from '@eeacms/volto-eea-chatbot/AISearchInput/schema';

describe('AISearchInputSchema', () => {
  const mockIntl = {
    formatMessage: ({ id, defaultMessage }) => defaultMessage || id,
  };

  it('returns schema with title', () => {
    const schema = AISearchInputSchema({ intl: mockIntl, data: {} });
    expect(schema.title).toBe('AI Search Input');
  });

  it('has required fields containing assistantEndpoint', () => {
    const schema = AISearchInputSchema({ intl: mockIntl, data: {} });
    expect(schema.required).toContain('assistantEndpoint');
  });

  it('includes examplePrompts field when examplePromptsEnabled is true', () => {
    const schema = AISearchInputSchema({
      intl: mockIntl,
      data: { examplePromptsEnabled: true },
    });
    expect(schema.fieldsets[0].fields).toContain('examplePrompts');
  });

  it('excludes examplePrompts field when examplePromptsEnabled is false', () => {
    const schema = AISearchInputSchema({
      intl: mockIntl,
      data: { examplePromptsEnabled: false },
    });
    expect(schema.fieldsets[0].fields).not.toContain('examplePrompts');
  });

  it('excludes examplePrompts field when examplePromptsEnabled is undefined', () => {
    const schema = AISearchInputSchema({ intl: mockIntl, data: {} });
    expect(schema.fieldsets[0].fields).not.toContain('examplePrompts');
  });

  it('has correct default values', () => {
    const schema = AISearchInputSchema({ intl: mockIntl, data: {} });
    expect(schema.properties.showIcon.default).toBe(true);
    expect(schema.properties.deepResearch.default).toBe('unavailable');
    expect(schema.properties.stylingVariant.default).toBe('dark');
    expect(schema.properties.examplePromptsEnabled.default).toBe(false);
  });

  it('has deepResearch choices with all four options', () => {
    const schema = AISearchInputSchema({ intl: mockIntl, data: {} });
    const choices = schema.properties.deepResearch.choices;
    expect(choices).toContainEqual(['unavailable', 'Unavailable']);
    expect(choices).toContainEqual(['always_on', 'Always on']);
    expect(choices).toContainEqual(['user_on', 'User choice, on by default']);
    expect(choices).toContainEqual(['user_off', 'User choice, off by default']);
  });

  it('has stylingVariant choices with three options', () => {
    const schema = AISearchInputSchema({ intl: mockIntl, data: {} });
    const choices = schema.properties.stylingVariant.choices;
    expect(choices).toContainEqual(['dark', 'Dark']);
    expect(choices).toContainEqual(['light', 'Light']);
    expect(choices).toContainEqual(['accent', 'Accent']);
  });

  it('has disclaimerText with default slate content', () => {
    const schema = AISearchInputSchema({ intl: mockIntl, data: {} });
    const defaultVal = schema.properties.disclaimerText.default;
    expect(defaultVal).toBeDefined();
    expect(Array.isArray(defaultVal)).toBe(true);
    expect(defaultVal[0].type).toBe('p');
  });

  it('has assistantEndpoint with url widget', () => {
    const schema = AISearchInputSchema({ intl: mockIntl, data: {} });
    expect(schema.properties.assistantEndpoint.widget).toBe('url');
  });

  it('has introText with slate widget', () => {
    const schema = AISearchInputSchema({ intl: mockIntl, data: {} });
    expect(schema.properties.introText.widget).toBe('slate');
  });

  it('has examplePrompts with object_list widget', () => {
    const schema = AISearchInputSchema({ intl: mockIntl, data: {} });
    expect(schema.properties.examplePrompts.widget).toBe('object_list');
  });
});
