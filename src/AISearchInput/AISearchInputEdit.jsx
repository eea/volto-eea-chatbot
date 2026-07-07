import React from 'react';
import SidebarPortal from '@plone/volto/components/manage/Sidebar/SidebarPortal';
import BlockDataForm from '@plone/volto/components/manage/Form/BlockDataForm';

import AISearchInputView from './AISearchInputView';
import { AISearchInputSchema } from './schema';

const AISearchInputEdit = (props) => {
  const { onChangeBlock, block, data } = props;

  const schema = React.useMemo(() => AISearchInputSchema({ data }), [data]);

  return (
    <div>
      <AISearchInputView {...props} isEditMode />
      <SidebarPortal selected={props.selected}>
        <BlockDataForm
          schema={schema}
          title={schema.title}
          block={block}
          onChangeBlock={onChangeBlock}
          onChangeField={(id, value) => {
            onChangeBlock(block, { ...data, [id]: value });
          }}
          formData={data}
        />
      </SidebarPortal>
    </div>
  );
};

export default AISearchInputEdit;
