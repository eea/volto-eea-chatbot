import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Persona } from '@eeacms/volto-eea-chatbot/ChatBlock/types/interfaces';

interface UseActivePersonaArgs {
  /** The persona the block loaded: `?assistant=` or the configured default. */
  primary: Persona;
  /** Every offered assistant whose record has arrived. */
  options: Persona[];
  /** True while the remaining assistants are still loading. */
  loading: boolean;
  /** Every assistant the block offers, configured ids, not resolved ones. */
  offeredIds: string[];
  initialId?: string | number | null;
}

export interface ActivePersona {
  activeId: string;
  persona: Persona;
  /** False only while the selected id has no record to render yet. */
  isResolved: boolean;
  select: (persona: Persona | string | number) => void;
  adopt: (id?: string | number | null) => void;
}

/**
 * The one owner of "which assistant is active": the selection, the record that
 * backs it, adopting a persona recorded elsewhere (a shared conversation), and
 * the fall back when a selected record never arrives.
 */
export function useActivePersona({
  primary,
  options,
  loading,
  offeredIds,
  initialId,
}: UseActivePersonaArgs): ActivePersona {
  const [activeId, setActiveId] = useState<string>(() =>
    String(initialId || primary.id),
  );

  const offeredRef = useRef<string[]>(offeredIds);
  offeredRef.current = offeredIds;

  const isResolved = useMemo(
    () =>
      options.some((option) => String(option.id) === activeId) ||
      String(primary.id) === activeId,
    [options, primary, activeId],
  );

  const persona = useMemo(
    () =>
      options.find((option) => String(option.id) === activeId) || primary,
    [options, activeId, primary],
  );

  const select = useCallback((next: Persona | string | number) => {
    setActiveId(String(typeof next === 'object' ? next.id : next));
  }, []);

  const adopt = useCallback((id?: string | number | null) => {
    const wanted = id === null || id === undefined ? null : String(id);
    if (wanted && offeredRef.current.includes(wanted)) {
      setActiveId(wanted);
    } else if (offeredRef.current.length > 0) {
      // Recorded assistant not offered here: use the block's own default.
      setActiveId(offeredRef.current[0]);
    }
  }, []);

  useEffect(() => {
    if (!loading && !isResolved) {
      setActiveId(String(primary.id));
    }
  }, [loading, isResolved, primary.id]);

  return { activeId, persona, isResolved, select, adopt };
}

export default useActivePersona;
