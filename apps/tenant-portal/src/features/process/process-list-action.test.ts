import { describe, expect, it } from 'vitest';
import type { WorkflowProcessDefinition } from '@24bid/api-client';
import { resolveProcessListPrimaryAction } from './process-list-action';

const process = (id: string, businessType: string) => ({ id, businessType }) as WorkflowProcessDefinition;

describe('process definition list action', () => {
  it('opens the existing definition so a new Flowable version can be published', () => {
    expect(resolveProcessListPrimaryAction([process('proc-demand', 'purchase_demand')], 'purchase_demand'))
      .toEqual({ type: 'configure', processId: 'proc-demand' });
  });

  it('creates a definition only when the selected business type is not configured', () => {
    expect(resolveProcessListPrimaryAction([process('proc-demand', 'purchase_demand')], 'rfq_award'))
      .toEqual({ type: 'create' });
  });
});
