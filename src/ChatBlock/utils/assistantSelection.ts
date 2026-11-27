import { parse } from 'qs';

export interface AssistantSelectionData {
  assistant?: number | string | null;
  switchableAssistants?: (number | string)[] | null;
}

/** Ids arrive as strings from the widget and as numbers from the API. */
export function normalizeAssistantId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const id = String(value).trim();
  if (!id || id === 'null' || id === 'undefined') return null;
  return id;
}

export function personaUrl(id: number | string): string {
  return `/_da/persona/${id}`;
}

/** Default first, then the switchable ones; the default is always included. */
export function getOfferedAssistantIds(
  data?: AssistantSelectionData | null,
): string[] {
  const ids: string[] = [];
  const push = (value: unknown) => {
    const id = normalizeAssistantId(value);
    if (id && !ids.includes(id)) ids.push(id);
  };

  push(data?.assistant);
  (data?.switchableAssistants || []).forEach(push);
  return ids;
}

export function parseAssistantQuery(search?: string | null): string | null {
  const parsed = parse((search || '').replace(/^\?/, '')) || {};
  return normalizeAssistantId(parsed.assistant);
}

/** `?assistant=` when it names an offered assistant, otherwise the default. */
export function resolveInitialAssistantId(
  data?: AssistantSelectionData | null,
  search?: string | null,
): string | null {
  const offered = getOfferedAssistantIds(data);
  if (offered.length === 0) return null;
  const requested = parseAssistantQuery(search);
  return requested && offered.includes(requested) ? requested : offered[0];
}

/** Drop only `query`, keeping every other parameter. */
export function withoutQueryParam(search?: string | null): string {
  const parsed = parse((search || '').replace(/^\?/, '')) || {};
  delete parsed.query;
  const remaining = Object.keys(parsed);
  if (remaining.length === 0) return '';
  const params = new URLSearchParams();
  remaining.forEach((key) => {
    const value = parsed[key];
    (Array.isArray(value) ? value : [value]).forEach((entry) => {
      if (entry !== null && entry !== undefined) {
        params.append(key, String(entry));
      }
    });
  });
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}
