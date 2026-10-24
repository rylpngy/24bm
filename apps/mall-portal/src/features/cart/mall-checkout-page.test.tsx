import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { MallCheckoutPage } from './mall-checkout-page';
const state=vi.hoisted(()=>({ requireAddress:false, mutate:vi.fn() }));
vi.mock('../../lib/use-mall-permissions',()=>({useMallPermissions:()=>({can:()=>true})}));
vi.mock('@24bid/api-client/mall-purchasing',()=>({useMallPurchaseControl:()=>({data:{categoryIds:[],requireAddress:state.requireAddress,maxCheckoutAmount:100},isLoading:false})}));
vi.mock('@24bid/api-client',()=>({
  useBuyerMallCart:()=>({data:{data:{groups:[],total:20,itemCount:1}}}),
  useBuyerMallAddresses:()=>({data:{data:[]}}),useBuyerMallAddAddress:()=>({}),
  useBuyerMallCheckoutServerCart:()=>({mutate:state.mutate,isPending:false}),
}));
afterEach(()=>{cleanup();vi.clearAllMocks();state.requireAddress=false;});
function show(){render(<QueryClientProvider client={new QueryClient()}><MallCheckoutPage onNavigate={()=>{}} /></QueryClientProvider>);}
it('sends one keyed checkout even on rapid clicks',()=>{
  show();fireEvent.click(screen.getByRole('button',{name:'提交订单'}));fireEvent.click(screen.getByRole('button',{name:'提交订单'}));
  expect(state.mutate).toHaveBeenCalledTimes(1);
  expect(state.mutate.mock.calls[0][0].data.idempotencyKey).toMatch(/^[a-f0-9-]{36}$/);
});
it('explains enterprise address requirement before blocking submission',()=>{
  state.requireAddress=true;show();
  expect(screen.getByText('必须选择')).toBeTruthy();expect(screen.getByRole('button',{name:'提交订单'})).toBeDisabled();
});
