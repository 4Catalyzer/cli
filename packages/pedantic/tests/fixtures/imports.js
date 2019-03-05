import createFarceRouter from 'found/lib/createFarceRouter';
import ScrollManager from 'found-scroll/lib/ScrollManager';
import PropTypes from 'prop-types';
import React from 'react';
import { remove } from 'react-formal/lib/util/ErrorUtils';
import Relay from 'react-relay';
import getNodes from '@qsi/common/lib/getNodes';
import Card from '@qsi/ui/lib/Card';
import Fieldset from '@qsi/ui/lib/Fieldset';
import Form from '@qsi/ui/lib/RelayForm';
import { omitExtraProps } from '@qsi/ui/lib/utils/Props';
import PageForm from '@qsi/ui-app/lib/PageForm';
import theme from '@qsi/ui-theme';

import EntityFormSection from 'components/EntityFormSection';
import ParamsFormSection from 'components/ParamsFormSection';
import WorkflowInput, {
  fragments as inputFragments,
} from 'components/WorkflowInput';
import type messages from 'messages/analysis';
import workflowMessages from 'messages/analysisWorkflow';
import fetchWorkflowParams from 'utils/fetchWorkflowParams';
import analysisSchema, {
  deserialize,
  serialize,
  setParams,
  setWorkflow,
} from '../schemas/analysis';
import SampleAssociationFormSection, {
  fragments as sampleAssocFragments,
} from './SampleAssociationFormSection';

import './styles.css';
import lessStyles from '@qsi/ui/styles/text.less';
import sassStyles from '@qsi/ui/styles/text.scss';
import styles from './foo.css';

const foo: string = (
  <>
    <div f='fg'>{foo} </div>
  </>
);

type Foo = {| bar: boolean |};
