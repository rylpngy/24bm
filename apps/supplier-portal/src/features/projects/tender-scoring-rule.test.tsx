import {cleanup,render,screen} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,expect,it,vi} from 'vitest';
import {SupplierTenderScoringRule} from './tender-scoring-rule';
const state=vi.hoisted(()=>({method:'综合评分法'}));
vi.mock('@24bid/api-client',()=>({supplierTenderScoringRule:async()=>({data:{evaluationMethod:state.method,revision:2,weights:{technical:40,commercial:30,price:30}}})}));
afterEach(()=>{cleanup();state.method='综合评分法';});
function show(){render(<QueryClientProvider client={new QueryClient()}><SupplierTenderScoringRule tenderId="t-1"/></QueryClientProvider>);}
it('discloses the actual published weights without editing controls',async()=>{show();await screen.findByText(/技术均分×40%/);expect(screen.queryByRole('spinbutton')).toBeNull();expect(screen.getByText(/版本 2/)).toBeVisible();});
it('explains the lowest-price method instead of showing composite weights',async()=>{state.method='最低评标价法';show();await screen.findByText('按有效报价从低到高排序。');expect(screen.queryByText(/技术均分×/)).toBeNull();});
