import sparkleSVG from '@eeacms/volto-eea-chatbot/icons/sparkle.svg';
import AISearchInputView from './AISearchInputView';
import AISearchInputEdit from './AISearchInputEdit';
import { AISearchInputSchema } from './schema';

// The block is offered to Managers everywhere, and to any role on content
// living under a sandbox path (e.g. /en/sandbox), so that non-Managers can
// add and experiment with it there.
export const SANDBOX_PATH = '/sandbox';

export const isAISearchInputRestricted = ({ user, properties }) => {
  // properties['@id'] is the backend API url of the page being edited
  const id = properties?.['@id'];
  if (typeof id === 'string' && id.includes(SANDBOX_PATH)) {
    return false;
  }

  if (user?.roles) {
    return !user.roles.find((role) => role === 'Manager');
  }
  // backward compatibility for older Volto versions
  return false;
};

export default function installAISearchInputBlock(config) {
  config.blocks.blocksConfig.eeaAISearchInput = {
    id: 'eeaAISearchInput',
    title: 'AI Search Input',
    icon: sparkleSVG,
    group: 'common',
    view: AISearchInputView,
    edit: AISearchInputEdit,
    restricted: isAISearchInputRestricted,
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
