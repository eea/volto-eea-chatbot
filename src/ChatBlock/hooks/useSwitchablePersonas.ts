import { useEffect, useMemo, useState } from 'react';
import type { Persona } from '@eeacms/volto-eea-chatbot/ChatBlock/types/interfaces';
import {
  normalizeAssistantId,
  personaUrl,
} from '@eeacms/volto-eea-chatbot/ChatBlock/utils/assistantSelection';

interface UseSwitchablePersonasOptions {
  /** Skip fetching entirely, e.g. in edit mode. */
  disabled?: boolean;
}

interface SwitchablePersonasState {
  personas: Persona[];
  isLoading: boolean;
}

function normalizeIds(ids: (number | string)[] | null | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  (ids || []).forEach((id) => {
    const value = normalizeAssistantId(id);
    if (!value || seen.has(value)) return;
    seen.add(value);
    result.push(value);
  });
  return result;
}

/** Persona records for the switchable assistants; one failure drops one assistant. */
export function useSwitchablePersonas(
  ids: (number | string)[] | null | undefined,
  { disabled = false }: UseSwitchablePersonasOptions = {},
): SwitchablePersonasState {
  const key = useMemo(
    () => (disabled ? '' : normalizeIds(ids).join(',')),
    // The array identity changes on every render, the joined key does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled, ids],
  );

  const [state, setState] = useState<SwitchablePersonasState>(() => ({
    personas: [],
    isLoading: key !== '',
  }));

  useEffect(() => {
    const list = key ? key.split(',') : [];

    if (list.length === 0) {
      setState({ personas: [], isLoading: false });
      return undefined;
    }

    let cancelled = false;
    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    setState({ personas: [], isLoading: true });

    // Each record is usable as soon as it arrives: one slow or hung request
    // must not hold back the rest.
    const arrived = new Map<number, Persona>();
    let pending = list.length;

    const publish = () => {
      if (cancelled) return;
      setState({
        personas: list
          .map((_, index) => arrived.get(index))
          .filter((persona): persona is Persona => Boolean(persona)),
        isLoading: pending > 0,
      });
    };

    list.forEach((id, index) => {
      fetch(personaUrl(id), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller?.signal,
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`${response.status} ${response.statusText}`);
          }
          return response.json();
        })
        .then((persona: Persona) => {
          arrived.set(index, persona);
        })
        .catch((reason) => {
          if (cancelled) return;
          // eslint-disable-next-line no-console
          console.warn(
            `Assistant ${id} could not be loaded and was dropped from the selector`,
            reason?.message || reason,
          );
        })
        .finally(() => {
          pending -= 1;
          publish();
        });
    });

    return () => {
      cancelled = true;
      controller?.abort();
    };
  }, [key]);

  return state;
}

export default useSwitchablePersonas;
