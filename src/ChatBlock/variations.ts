import type { ComponentType } from 'react';
import config from '@plone/volto/registry';

/**
 * A chatbot block presentation variation.
 *
 * The `view` component is a complete presentation of the chatbot block.
 * It receives the same props the classic presentation (ChatWindow) receives
 * today: `{ persona, data, block_id, isEditMode, isPlaywrightTest,
 * initialQuery, initialDeepResearch, ... }` plus whatever the HOCs inject
 * (e.g. `rehypePrism`, `remarkGfm` when the view wraps itself with
 * `injectLazyLibs`).
 */
export interface ChatBlockVariation {
  id: string;
  title: string;
  isDefault?: boolean;
  view: ComponentType<any>;
  edit?: ComponentType<any>;
  schemaEnhancer?: (args: { schema: any; formData: any }) => any;
}

/**
 * Resolve the active variation from the block data.
 *
 * Semantics follow the established `variations` pattern of the EEA Volto
 * addons (volto-tabs-block, volto-block-data-table, listing block):
 * explicit `data.variation` → `isDefault` → first registered → undefined.
 * Old block content without a `variation` field resolves to the default.
 */
export function getChatVariation(
  data: Record<string, any>,
): ChatBlockVariation | undefined {
  const variations: ChatBlockVariation[] =
    config.blocks?.blocksConfig?.eeaChatbot?.variations ?? [];
  if (variations.length === 0) {
    return undefined;
  }
  return (
    variations.find((v) => v.id === data?.variation) ??
    variations.find((v) => v.isDefault) ??
    variations[0]
  );
}
