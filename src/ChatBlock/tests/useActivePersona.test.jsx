import { renderHook, act } from '@testing-library/react-hooks';

import { useActivePersona } from '@eeacms/volto-eea-chatbot/ChatBlock/hooks/useActivePersona';

const climate = { id: 34, name: 'Climate Assistant' };
const research = { id: 29, name: 'Research Assistant' };
const briefing = { id: 17, name: 'Briefing Assistant' };

const setup = (overrides = {}) =>
  renderHook(
    (props) =>
      useActivePersona({
        primary: climate,
        options: [climate, research],
        loading: false,
        offeredIds: ['34', '29'],
        ...props,
      }),
    { initialProps: { ...overrides } },
  );

describe('useActivePersona', () => {
  it('starts on the resolved initial assistant', () => {
    const { result } = setup({ initialId: '29' });

    expect(result.current.activeId).toBe('29');
    expect(result.current.persona).toEqual(research);
    expect(result.current.isResolved).toBe(true);
  });

  it('renders the primary persona as a stand-in while the selected record is missing', () => {
    const { result } = setup({
      initialId: '29',
      options: [climate],
      loading: true,
    });

    expect(result.current.isResolved).toBe(false);
    expect(result.current.persona).toEqual(climate);
  });

  it('selects another assistant', () => {
    const { result } = setup();

    act(() => result.current.select(research));

    expect(result.current.activeId).toBe('29');
    expect(result.current.persona).toEqual(research);
  });

  it('adopts an assistant recorded elsewhere when the block offers it', () => {
    const { result } = setup();

    act(() => result.current.adopt(29));

    expect(result.current.activeId).toBe('29');
    expect(result.current.persona).toEqual(research);
  });

  it('adopts the block default when the recorded assistant is not offered', () => {
    const { result } = setup();

    act(() => result.current.adopt(briefing.id));

    expect(result.current.activeId).toBe('34');
  });

  it('adopts the block default when the conversation records no assistant', () => {
    const { result } = setup({ initialId: '29', options: [climate, research] });

    act(() => result.current.adopt(null));

    expect(result.current.activeId).toBe('34');
  });

  it('falls back to the primary persona when the selected record never arrives', () => {
    const { result, rerender } = renderHook(
      (props) => useActivePersona(props),
      {
        initialProps: {
          primary: climate,
          options: [],
          loading: true,
          offeredIds: ['34', '29'],
          initialId: '29',
        },
      },
    );

    expect(result.current.isResolved).toBe(false);

    rerender({
      primary: climate,
      options: [climate],
      loading: false,
      offeredIds: ['34', '29'],
      initialId: '29',
    });

    expect(result.current.activeId).toBe('34');
    expect(result.current.isResolved).toBe(true);
  });

  it('does not fall back while the remaining assistants are still loading', () => {
    const { result } = setup({ initialId: '29', options: [], loading: true });

    expect(result.current.activeId).toBe('29');
    expect(result.current.isResolved).toBe(false);
  });
});
