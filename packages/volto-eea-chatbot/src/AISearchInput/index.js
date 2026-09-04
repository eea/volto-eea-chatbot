import sparkleSVG from '@eeacms/volto-eea-chatbot/icons/sparkle.svg';
import AISearchInputView from './AISearchInputView';
import AISearchInputEdit from './AISearchInputEdit';
import { AISearchInputSchema } from './schema';

export default function installAISearchInputBlock(config) {
  config.blocks.blocksConfig.eeaAISearchInput = {
    id: 'eeaAISearchInput',
    title: 'AI Search Input',
    icon: sparkleSVG,
    group: 'common',
    view: AISearchInputView,
    edit: AISearchInputEdit,
    restricted: ({ user }) => {
      if (user?.roles) {
        return !user.roles.find((role) => role === 'Manager');
      }
      return false;
    },
    mostUsed: false,
    blockHasOwnFocusManagement: false,
    sidebarTab: 1,
    schema: AISearchInputSchema,
    security: {
      addPermission: [],
      view: [],
    },
    variations: [],
  };

  return config;
}
