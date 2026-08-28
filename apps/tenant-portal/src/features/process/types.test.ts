import { describe, expect, it } from 'vitest';
import { isWorkflowIdentifier, parseWorkflowDraft, uid } from './types';

describe('workflow schema identifier compatibility', () => {
  it('generates Flowable-compatible identifiers for new designer elements', () => {
    expect(isWorkflowIdentifier(uid('field'))).toBe(true);
    expect(isWorkflowIdentifier(uid('step'))).toBe(true);
  });

  it('repairs legacy hyphenated identifiers and keeps condition references aligned', () => {
    const draft = parseWorkflowDraft(
      JSON.stringify({
        fields: [
          { id: 'f-legacy-1', type: 'text', label: '项目名称', required: true },
          { id: 'f-legacy-2', type: 'textarea', label: '项目说明', required: false },
        ],
      }),
      JSON.stringify({
        steps: [{
          id: 's-legacy-1',
          type: 'condition',
          branches: [
            {
              label: '有项目名称',
              condition: { field: 'f-legacy-1', op: '==', value: '采购项目' },
              steps: [{ id: 'b-legacy-1', type: 'approver', title: '采购复核' }],
            },
            {
              label: '其他情况',
              steps: [{ id: 'b-legacy-2', type: 'approver', title: '常规复核' }],
            },
          ],
        }],
      }),
    );

    expect(draft.repairedIdentifiers).toBe(true);
    expect(draft.fields.map((field) => field.id)).toEqual(['f_legacy_1', 'f_legacy_2']);
    expect(draft.fields.every((field) => isWorkflowIdentifier(field.id))).toBe(true);
    expect(draft.steps[0]?.id).toBe('s_legacy_1');
    expect(draft.steps[0]?.branches?.[0]?.condition?.field).toBe('f_legacy_1');
    expect(draft.steps[0]?.branches?.flatMap((branch) => branch.steps).every((step) => isWorkflowIdentifier(step.id))).toBe(true);
  });
});
