import { useEffect, useMemo, useRef, useState } from 'react';

import {
  CHUNK_EVIDENCE_WINDOW,
  fetchEvidence,
} from '@eeacms/volto-eea-chatbot/ChatBlock/services/chunkEvidence';

/**
 * Resolve real Onyx chunk text for the documents about to be sent to the
 * fact-checker.
 *
 * Only runs when `enabled` (i.e. quality control is being requested), and
 * re-runs only when the set of `document_id` + `chunk_ind` values changes.
 *
 * `evidenceSettled` is what callers must gate the fact-check call on. It is
 * false for a key that has not been resolved yet, so the check cannot fire with
 * blurbs in the same commit that started the evidence fetch. It also becomes
 * true when a fetch fails — falling back to blurbs is better than never
 * verifying at all.
 */
export function useChunkEvidence(
  docs: any[],
  {
    enabled = true,
    window = CHUNK_EVIDENCE_WINDOW,
  }: { enabled?: boolean; window?: number } = {},
) {
  const [evidence, setEvidence] = useState<Record<string, any>>({});
  const [isFetchingEvidence, setIsFetchingEvidence] = useState(false);
  const [settledKey, setSettledKey] = useState('');

  const docsRef = useRef(docs);
  docsRef.current = docs;

  const key = useMemo(
    () =>
      (docs || [])
        .map((doc: any) => `${doc?.document_id}@@${doc?.chunk_ind ?? 0}`)
        .filter((part: string) => !part.startsWith('undefined'))
        .join('|'),
    [docs],
  );

  useEffect(() => {
    if (!enabled || !key) {
      setIsFetchingEvidence(false);
      return;
    }

    let cancelled = false;
    setIsFetchingEvidence(true);

    fetchEvidence(docsRef.current, { window })
      .then((result) => {
        if (cancelled) {
          return;
        }
        setEvidence(result);
        setIsFetchingEvidence(false);
        setSettledKey(key);
      })
      .catch(() => {
        // Fall back to whatever the stream gave us (blurbs).
        if (!cancelled) {
          setIsFetchingEvidence(false);
          setSettledKey(key);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [key, enabled, window]);

  return {
    evidence,
    isFetchingEvidence,
    evidenceSettled: key === '' || settledKey === key,
  };
}
