import { renderHook } from '@testing-library/react-hooks';
import { useMarked } from '../hooks/useMarked';

describe('useMarked', () => {
  const createMockLibs = () => ({
    highlightJs: {
      default: {
        getLanguage: jest.fn((lang) => (lang === 'javascript' ? true : false)),
        highlight: jest.fn((lang, code) => ({
          value: `<highlighted>${code}</highlighted>`,
        })),
      },
    },
    marked: {
      marked: {
        setOptions: jest.fn(),
        parse: jest.fn((text) => Promise.resolve(`<p>${text}</p>`)),
      },
      Renderer: jest.fn().mockImplementation(function () {
        this.paragraph = null;
        this.list = null;
        this.listitem = null;
        this.code = null;
      }),
    },
  });

  it('returns a parser function', () => {
    const libs = createMockLibs();
    const { result } = renderHook(() => useMarked(libs));
    expect(result.current.parser).toBeDefined();
    expect(typeof result.current.parser).toBe('function');
  });

  it('parser calls marked.parse', async () => {
    const libs = createMockLibs();
    const { result } = renderHook(() => useMarked(libs));

    const output = await result.current.parser('Hello world');
    expect(libs.marked.marked.parse).toHaveBeenCalledWith('Hello world');
  });

  it('sets up renderer with custom paragraph', () => {
    const libs = createMockLibs();
    renderHook(() => useMarked(libs));

    // The renderer instance should have custom methods
    const rendererInstance = libs.marked.Renderer.mock.instances[0];
    expect(rendererInstance.paragraph).toBeDefined();
    expect(rendererInstance.paragraph('text')).toBe('text\n');
  });

  it('sets up renderer with custom list', () => {
    const libs = createMockLibs();
    renderHook(() => useMarked(libs));

    const rendererInstance = libs.marked.Renderer.mock.instances[0];
    expect(rendererInstance.list('items')).toBe('items\n\n');
  });

  it('sets up renderer with custom listitem', () => {
    const libs = createMockLibs();
    renderHook(() => useMarked(libs));

    const rendererInstance = libs.marked.Renderer.mock.instances[0];
    expect(rendererInstance.listitem('item text')).toBe('\n• item text');
  });

  it('sets up renderer with custom code highlighting', () => {
    const libs = createMockLibs();
    renderHook(() => useMarked(libs));

    const rendererInstance = libs.marked.Renderer.mock.instances[0];
    const result = rendererInstance.code('const x = 1;', 'javascript');

    expect(result).toContain('<pre');
    expect(result).toContain('<highlighted>');
    expect(libs.highlightJs.default.highlight).toHaveBeenCalledWith(
      'javascript',
      'const x = 1;',
    );
  });

  it('falls back to plaintext for unknown languages', () => {
    const libs = createMockLibs();
    renderHook(() => useMarked(libs));

    const rendererInstance = libs.marked.Renderer.mock.instances[0];
    rendererInstance.code('some code', 'unknownlang');

    expect(libs.highlightJs.default.highlight).toHaveBeenCalledWith(
      'plaintext',
      'some code',
    );
  });

  it('calls setOptions with the renderer', () => {
    const libs = createMockLibs();
    renderHook(() => useMarked(libs));

    expect(libs.marked.marked.setOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        renderer: expect.any(Object),
      }),
    );
  });
});
