import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { FundingUnpaidReallocation, FundingReallocationEvidence } from './funding-unpaid-reallocation';
const sources=[{fundId:'a',code:'A',name:'专项 A',allocatedAmount:70,paidAmount:20},{fundId:'b',code:'B',name:'专项 B',allocatedAmount:30,paidAmount:10}];
function show(blocker='') {const submit=vi.fn();render(<FundingUnpaidReallocation project={{id:'p',revision:3}} sources={sources} priorPaidAmount={50} blocker={blocker} onPropose={submit}/>);return submit;}
it('keeps totals and paid attribution fixed before allowing independent approval',()=>{
  const submit=show();fireEvent.click(screen.getByRole('button',{name:'调整未付额度'}));fireEvent.change(screen.getByLabelText('未付额度调整原因'),{target:{value:'将未付10元调整至B'}});
  expect((screen.getByRole('button',{name:'下一步'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('调整后责任 A'),{target:{value:'60'}});expect((screen.getByRole('button',{name:'下一步'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('调整后责任 B'),{target:{value:'40'}});fireEvent.click(screen.getByRole('button',{name:'下一步'}));
  expect(submit).toHaveBeenCalledWith({kind:'project_reallocation',projectId:'p',revision:3,amount:100,reason:'将未付10元调整至B',lines:[{fundId:'a',amount:60},{fundId:'b',amount:40}]});
});
it('rejects below-paid and excess-precision values even when total is conserved',()=>{
  show();fireEvent.click(screen.getByRole('button',{name:'调整未付额度'}));fireEvent.change(screen.getByLabelText('未付额度调整原因'),{target:{value:'核对'}});
  fireEvent.change(screen.getByLabelText('调整后责任 A'),{target:{value:'19'}});fireEvent.change(screen.getByLabelText('调整后责任 B'),{target:{value:'81'}});expect((screen.getByRole('button',{name:'下一步'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('调整后责任 A'),{target:{value:'60.001'}});fireEvent.change(screen.getByLabelText('调整后责任 B'),{target:{value:'39.999'}});expect((screen.getByRole('button',{name:'下一步'}) as HTMLButtonElement).disabled).toBe(true);
});
it('disables a blocked project and exposes the actual server reason',()=>{
  show('资金审批中');const b=screen.getByRole('button',{name:'调整未付额度'}) as HTMLButtonElement;expect(b.disabled).toBe(true);expect(b.title).toBe('资金审批中');
});
it('renders original/adjusted responsibilities and retained paid basis in history',()=>{
  render(<FundingReallocationEvidence snapshot={JSON.stringify({reallocation:{period:'2026',lines:[{fundId:'a',name:'专项 A',beforeAmount:70,afterAmount:60,paidAmount:20}]}})}/>);
  expect(screen.getByRole('region',{name:'未付资金调整依据'}).textContent).toContain('原已付归属 ¥20.00 不变');
});
