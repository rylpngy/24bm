import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import type { WorkflowInstanceHistory } from '@24bid/api-client';
import { WorkflowInstancePanel, workflowBusinessHref, workflowFormLabels } from './workflow-instance-panel';

describe('workflow history form display', () => {
  it('retains the active solution in business links and directs batches to their workbench', () => {
    window.history.replaceState(null, '', '/?solution=ludong-poc&module=contracts&recordId=old');
    const request = new URL(workflowBusinessHref({ businessType: 'payment_request', businessId: 'request-1', businessSnapshot: { invoiceId: 'invoice-1' } })!, window.location.origin);
    expect(Object.fromEntries(request.searchParams)).toEqual({ module: 'invoices', recordId: 'invoice-1', solution: 'ludong-poc' });
    const batch = new URL(workflowBusinessHref({ businessType: 'payment_batch', businessId: 'batch-1', businessSnapshot: {} })!, window.location.origin);
    expect(Object.fromEntries(batch.searchParams)).toEqual({ module: 'invoices', financeView: 'batches', solution: 'ludong-poc' });
    window.history.replaceState(null, '', '/');
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
