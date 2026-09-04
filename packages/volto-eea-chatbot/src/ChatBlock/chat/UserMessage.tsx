import type { ChatMessageProps } from '@eeacms/volto-eea-chatbot/ChatBlock/types/interfaces';
import loadable from '@loadable/component';
import SVGIcon from '@eeacms/volto-eea-chatbot/ChatBlock/components/Icon';
import { components } from '@eeacms/volto-eea-chatbot/ChatBlock/components/markdown';
import UserIcon from '@eeacms/volto-eea-chatbot/icons/user.svg';

const Markdown: any = loadable(() => import('react-markdown'));

export function UserMessage({
  message,
  className = '',
  libs,
}: ChatMessageProps) {
  const { remarkGfm } = libs;
  return (
    <div className={`comment ${className}`}>
      <div className="circle user">
        <SVGIcon name={UserIcon} size={20} color="white" />
      </div>
      <div>
        <Markdown components={components(message)} remarkPlugins={[remarkGfm]}>
          {message.message}
        </Markdown>
      </div>
    </div>
  );
}
