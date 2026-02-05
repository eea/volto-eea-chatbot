import { useMemo, useEffect } from 'react';
import superagent from 'superagent';
import { parse } from 'qs';
import withOnyxData from './hocs/withOnyxData';
import { ChatWindow } from './chat';

function ChatBlockView(props) {
  const { id, assistantData, data, isEditMode, location } = props;

  const query = useMemo(
    () => parse(location?.search.replace('?', '')) || {},
    [location],
  );

  const isPlaywrightTest = query.playwright === 'yes';

  useEffect(() => {
    if (isPlaywrightTest) {
      window.__EEA_CHATBOT_TEST_CONFIG__ = {
        block_id: id,
        ...data,
      };
    }
  }, [id, isPlaywrightTest, data]);

  return assistantData ? (
    <ChatWindow
      persona={assistantData}
      isEditMode={isEditMode}
      isPlaywrightTest={isPlaywrightTest}
      block_id={id}
      {...data}
    />
  ) : (
    <div>Chatbot</div>
  );
}

export default withOnyxData((props) => [
  'assistantData',
  typeof props.data?.assistant !== 'undefined'
    ? superagent.get(`/_da/persona/${props.data.assistant}`).type('json')
    : null,
  props.data?.assistant,
])(ChatBlockView);
