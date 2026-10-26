import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { WorkflowAttachmentConfig, type WorkflowAttachmentCategory } from './workflow-attachment-config';

afterEach(cleanup);
const catalog=[{id:'project_attachment',label:'项目附件',required:false},{id:'mall_confirmation',label:'商城材料',required:false},
  {id:'supplementary_evidence',label:'补充证明',required:false},{id:'custom_1',label:'自定义材料1',required:false}];
function Example(){
  const [value,setValue]=useState<WorkflowAttachmentCategory[]>();
  return <WorkflowAttachmentConfig value={value} onChange={setValue} catalog={catalog} />;
}
it('explicitly enables versioned requirements without silently requiring legacy materials',()=>{
  render(<Example />);
  expect(screen.getByText('沿用基础附件分类，不拦截提交。')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'配置附件要求'}));
  expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  expect(screen.getAllByRole('checkbox').every(item=>!(item as HTMLInputElement).checked)).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'增加材料分类'}));
  fireEvent.change(screen.getByLabelText('附件分类名称4'),{target:{value:'市场调研报告'}});
  fireEvent.click(screen.getAllByRole('checkbox')[3]);
  expect(screen.getByLabelText('附件分类名称4')).toHaveValue('市场调研报告');
  expect(screen.getAllByRole('checkbox')[3]).toBeChecked();
  expect(screen.getByRole('button',{name:'增加材料分类'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'移除市场调研报告'}));
  expect(screen.getAllByRole('checkbox')).toHaveLength(3);
});
