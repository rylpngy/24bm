import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import type { WorkflowInstanceHistory } from '@24bid/api-client';
import { WorkflowInstancePanel, workflowFormLabels } from './workflow-instance-panel';

describe('workflow history form display', () => {
  it('shows settlement line evidence rather than a raw financial JSON blob',()=>{
    const history:WorkflowInstanceHistory={workflowInstanceId:'settlement-flow',businessType:'order_settlement',businessId:'settlement-1',definitionVersionId:'v1',flowableProcessInstanceId:'f1',status:'approved',initiatorId:'buyer',formData:{},businessSnapshot:{orderId:'order-1',finalAmount:250,settlementSnapshot:{assessment:{baseline:{internal:'DO-NOT-RENDER'},lines:[{id:'line-1',description:'Settlement computer',quantity:3,retainedQuantity:1,cancelledQuantity:2,unitPrice:300,settlementUnitPrice:250}]}}},attachments:[],events:[]};
    render(<WorkflowInstancePanel history={history}/>);
    expect(screen.getByText('送审清算行明细')).toBeInTheDocument();expect(screen.getByText('Settlement computer')).toBeInTheDocument();expect(screen.getByText('约定清算总额')).toBeInTheDocument();expect(screen.queryByText(/DO-NOT-RENDER/)).toBeNull();
  });
  it('renders the bound schema labels and preserves unknown fields and false/zero values', () => {
    const history: WorkflowInstanceHistory = {
      workflowInstanceId: 'instance-1', businessType: 'buyer_supplier_exit', businessId: 'supplier-1',
      definitionVersionId: 'version-1', flowableProcessInstanceId: 'flow-1', status: 'approved',
      initiatorId: 'user-1', formData: { basis: '第一行\n第二行', legacy: '原始依据', checked: false, count: 0 },
      formSchema: JSON.stringify({ fields: [{ id: 'basis', label: '退出依据' }, { id: 'checked', label: '已核验' }] }),
      businessSnapshot: {}, attachments: [], events: [],
    };
    render(<WorkflowInstancePanel history={history} />);
    expect(screen.getByText('退出依据')).toBeInTheDocument();
    expect(screen.queryByText('basis')).not.toBeInTheDocument();
    expect(screen.getByText('第一行 第二行').textContent).toBe('第一行\n第二行');
    expect(screen.getByText('legacy')).toBeInTheDocument();
    expect(screen.getByText('原始依据')).toBeInTheDocument();
    expect(screen.getByText('否')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('does not rewrite legacy field identifiers', () => {
    expect(workflowFormLabels('{"fields":[{"id":"old-id","label":"历史字段"}]}').get('old-id'))
      .toBe('历史字段');
  });

  it('can omit a duplicate business snapshot without omitting the form or approval history', () => {
    const history: WorkflowInstanceHistory = {
      workflowInstanceId: 'project-instance', businessType: 'project_initiation', businessId: 'project-1',
      definitionVersionId: 'version-1', flowableProcessInstanceId: 'flow-1', status: 'approved',
      initiatorId: 'author', businessSnapshot: { title: 'Duplicate project basis' },
      formData: { basis: 'Specific project form' }, attachments: [], events: [],
    };
    render(<WorkflowInstancePanel history={history} hideBusinessSnapshot />);
    expect(screen.queryByText('Duplicate project basis')).toBeNull();
    expect(screen.getByText('Specific project form')).toBeInTheDocument();
    expect(screen.getAllByText('完整流转记录').length).toBeGreaterThan(0);
  });

  it.each([undefined, 'invalid', 'null', '{"fields":{}}', '{"fields":[null,{}, {"id":"x","label":""}]}'])
    ('handles absent or malformed historical schema: %s', (schema) => {
      expect(workflowFormLabels(schema).size).toBe(0);
    });
});
