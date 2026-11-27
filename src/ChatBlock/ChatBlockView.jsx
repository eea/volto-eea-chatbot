import { useMemo, useEffect } from 'react';
import superagent from 'superagent';
import { parse } from 'qs';
import withOnyxData from './hocs/withOnyxData';
import { ChatWindow } from './chat';
import { getChatVariation } from './variations';
import { useSwitchablePersonas } from './hooks/useSwitchablePersonas';
import {
  getOfferedAssistantIds,
  parseAssistantQuery,
  personaUrl,
  resolveInitialAssistantId,
} from './utils/assistantSelection';

function ChatBlockView(props) {
  const { id, assistantData, data, isEditMode, location } = props;

  const query = useMemo(
    () => parse(location?.search.replace('?', '')) || {},
    [location],
  );

  const isPlaywrightTest = query.playwright === 'yes';
  const initialQuery = query.query || null;
  const initialDeepResearch = query.deepResearch || null;
  const initialChatSessionId = query.chat || query.session || null;

  // `?assistant=` wins only when the editor offers that assistant.
  const initialAssistantId = useMemo(
    () => resolveInitialAssistantId(data, location?.search),
    [data, location],
  );

  const offeredAssistantIds = useMemo(
    () => getOfferedAssistantIds(data),
    [data],
  );

  const otherAssistantIds = useMemo(
    () => offeredAssistantIds.filter((id) => id !== initialAssistantId),
    [offeredAssistantIds, initialAssistantId],
  );

  const { personas: otherPersonas, isLoading: switchablePersonasLoading } =
    useSwitchablePersonas(otherAssistantIds, {
      disabled: Boolean(isEditMode) || !initialAssistantId,
    });

  // Default first, then configuration order.
  const personaOptions = useMemo(() => {
    const byId = new Map();
    if (assistantData) {
      byId.set(String(assistantData.id), assistantData);
    }
    otherPersonas.forEach((persona) => byId.set(String(persona.id), persona));
    return offeredAssistantIds
      .map((assistantId) => byId.get(assistantId))
      .filter(Boolean);
  }, [assistantData, otherPersonas, offeredAssistantIds]);

  // An unoffered `?assistant=` is ignored on purpose; only developers care.
  useEffect(() => {
    const requested = parseAssistantQuery(location?.search);
    if (requested && requested !== initialAssistantId) {
      // eslint-disable-next-line no-console
      console.warn(
        `[chatbot] ?assistant=${requested} is not offered by this block; opening on ${initialAssistantId}`,
      );
    }
  }, [location, initialAssistantId]);

  useEffect(() => {
    if (isPlaywrightTest) {
      window.__EEA_CHATBOT_TEST_CONFIG__ = {
        block_id: id,
        ...data,
      };
    }
  }, [id, isPlaywrightTest, data]);

  // Resolve the presentation variation for this block. Falls back to the
  // classic ChatWindow so the block keeps working even if the registry is
  // somehow empty.
  const Presentation = getChatVariation(data)?.view || ChatWindow;

  return assistantData ? (
    <Presentation
      persona={assistantData}
      personaOptions={personaOptions}
      personaOptionsLoading={switchablePersonasLoading}
      offeredAssistantIds={offeredAssistantIds}
      initialAssistantId={initialAssistantId}
      isEditMode={isEditMode}
      isPlaywrightTest={isPlaywrightTest}
      block_id={id}
      initialQuery={initialQuery}
      initialDeepResearch={initialDeepResearch}
      initialChatSessionId={initialChatSessionId}
      {...data}
    />
  ) : (
    <div>Chatbot</div>
  );
}

/**
 * The persona the block loads first. It is keyed on the *resolved* assistant,
 * not on the configured default, so the presentation (and its URL-triggered
 * auto-submit) never exists before the active persona is known.
 */
export function assistantDataDescriptor(props) {
  const id = resolveInitialAssistantId(props.data, props.location?.search);
  return [
    'assistantData',
    id ? superagent.get(personaUrl(id)).type('json') : null,
    id,
  ];
}

export default withOnyxData(assistantDataDescriptor)(ChatBlockView);
