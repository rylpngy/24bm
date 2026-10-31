import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { TenderScoringRulePanel } from './tender-scoring-rule-panel';
const mocks=vi.hoisted(()=>({method:'综合评分法',save:vi.fn()}));
vi.mock('@24bid/api-client',()=>({tenderScoringRule:async()=>({data:{evaluationMethod:mocks.method,revision:0,weights:{technical:50,commercial:20,price:30},history:[]}}),saveTenderScoringRule:(...args:unknown[])=>mocks.save(...args)}));
afterEach(()=>{cleanup();vi.clearAllMocks();mocks.method='综合评分法';});
function show(editable=true) {render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><TenderScoringRulePanel tenderId="t-1" editable={editable}/></QueryClientProvider>);}
it('requires a 100 percent sum and reason, submits the expected version',async()=>{
  mocks.save.mockResolvedValue({data:{}});show();
  const technical=await screen.findByLabelText('技术权重');
  fireEvent.change(technical,{target:{value:'70'}});
  fireEvent.change(screen.getByLabelText('编制或调整依据'),{target:{value:'项目技术要求'}});
  expect(screen.getByRole('button',{name:'保存评分规则'})).toBeDisabled();
  fireEvent.change(screen.getByLabelText('商务权重'),{target:{value:'10'}});
  fireEvent.change(screen.getByLabelText('价格权重'),{target:{value:'20'}});
  fireEvent.click(screen.getByRole('button',{name:'保存评分规则'}));
  await vi.waitFor(()=>expect(mocks.save).toHaveBeenCalledWith('t-1',{technicalWeight:70,commercialWeight:10,priceWeight:20,reason:'项目技术要求',expectedRevision:0}));
});
it('does not allow editing a locked project',async()=>{
  show(false);expect(await screen.findByLabelText('技术权重')).toBeDisabled();
  expect(screen.queryByRole('button',{name:'保存评分规则'})).toBeNull();
});
it('does not offer comprehensive weights for the lowest-price method',async()=>{
  mocks.method='最低评标价法';show();
  await screen.findByText('按有效报价从低到高排序，综合权重不参与定标排序。');
  expect(screen.queryByLabelText('技术权重')).toBeNull();
  expect(screen.queryByRole('button',{name:'保存评分规则'})).toBeNull();
});
