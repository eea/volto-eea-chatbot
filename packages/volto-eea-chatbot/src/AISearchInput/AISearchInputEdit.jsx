import React from 'react';
import { useIntl } from 'react-intl';
import SidebarPortal from '@plone/volto/components/manage/Sidebar/SidebarPortal';
import BlockDataForm from '@plone/volto/components/manage/Form/BlockDataForm';

import AISearchInputView from './AISearchInputView';
import { AISearchInputSchema } from './schema';

const AISearchInputEdit = (props) => {
  const { onChangeBlock, block, data } = props;
  const intl = useIntl();

  const schema = React.useMemo(
    () => AISearchInputSchema({ intl, data }),
    [data, intl],
  );

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
