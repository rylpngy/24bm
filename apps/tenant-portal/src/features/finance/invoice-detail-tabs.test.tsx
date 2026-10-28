import { useState, type ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { InvoicesPage } from './invoices-page';

const api = vi.hoisted(() => ({ matched: true, requests: vi.fn(), submit: vi.fn() }));
vi.mock('@24bid/api-client', () => ({
  useBuyerPaymentList: () => ({data:{data:[{id:'invoice',invoiceNo:'INV-DEMO',orderId:'order',amount:100,paymentStatus:'部分付款',
    reconciliationStatus:api.matched?'三单一致':'金额不一致',varianceAmount:api.matched?0:10,lineItems:[]}]}}),
  useBuyerSupplierList: () => ({data:{data:[]}}),
  useBuyerPaymentPaymentAuditLogs: () => ({data:{data:[{id:'log',action:'invoice.partial_paid',actorId:'finance',createdAt:'2026-10-28T08:00:00Z'}]}}),
  useWorkflowPaymentRequestCreate: () => ({mutate:api.submit}),
  useBuyerFinanceActionPaymentRequests: (params:unknown) => {api.requests(params);return {data:{data:[{id:'request-real',invoiceId:'invoice',requestStatus:'已通过',paymentBatchNo:'batch-real'}]}};},
}));
vi.mock('./payment-ledger-panel', () => ({PaymentLedgerPanel:()=>{
  const [value,setValue]=useState('');return <div id="payment-amount-ledger"><input aria-label="本次付款金额" value={value} onChange={e=>setValue(e.target.value)}/></div>;
}}));
vi.mock('./invoice-line-match-panel', () => ({InvoiceLineMatchPanel:()=> <p>行级匹配样本</p>}));
vi.mock('./reconciliation-variance-panel', () => ({ReconciliationVariancePanel:()=>{
  const [value,setValue]=useState('');return <input aria-label="差异处理说明" value={value} onChange={e=>setValue(e.target.value)}/>;
}}));
vi.mock('./payment-batches-page', () => ({PaymentBatchesPage:()=> <p>付款批次工作台</p>}));
vi.mock('./payment-reviews-page', () => ({PaymentReviewsPage:()=> <p>复核工作台</p>}));
vi.mock('../workflow/workflow-instance-panel', () => ({WorkflowStatusPanel:({businessType,businessId}:{businessType:string;businessId:string})=><p>{businessType}:{businessId}</p>}));
vi.mock('../workflow/workflow-submit-dialog', () => ({WorkflowSubmitDialog:({children,onSubmit}:{children:ReactNode;onSubmit:(data:object)=>void})=><div>{children}<button onClick={()=>onSubmit({reason:'申请说明'})}>确认提交样本</button></div>}));

beforeEach(()=>{api.matched=true;window.history.replaceState(null,'','/?solution=ludong-poc&module=invoices&recordId=invoice');});
afterEach(()=>{cleanup();vi.clearAllMocks();});
function show(){render(<QueryClientProvider client={new QueryClient()}><InvoicesPage/></QueryClientProvider>);}

it('opens the batch workbench from a workflow link and clears the subpage on return',()=>{
  window.history.replaceState(null,'','/?solution=ludong-poc&module=invoices&financeView=batches');
  show();expect(screen.getByText('付款批次工作台')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'返回发票台账'}));
  expect(screen.queryByText('付款批次工作台')).not.toBeInTheDocument();
  expect(new URLSearchParams(window.location.search).has('financeView')).toBe(false);
  expect(new URLSearchParams(window.location.search).get('solution')).toBe('ludong-poc');
});

it('separates invoice facts, matching, payment and execution without losing payment inputs',()=>{
  show();expect(screen.getByText('发票信息(增值税专用发票)')).toBeVisible();
  expect(screen.queryByLabelText('本次付款金额')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'三单匹配'}));
  expect(screen.getByText('行级匹配样本')).toBeVisible();
  expect(screen.getByText('发票信息(增值税专用发票)')).not.toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'付款登记'}));
  fireEvent.change(screen.getByLabelText('本次付款金额'),{target:{value:'30'}});
  fireEvent.click(screen.getByRole('button',{name:'执行记录'}));
  expect(screen.getByText('登记部分付款')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'付款登记'}));
  expect(screen.getByLabelText('本次付款金额')).toHaveValue('30');
});

it('loads actual request and batch workflow IDs, never the invoice ID as a request',()=>{
  show();expect(api.requests).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'审批记录'}));
  expect(api.requests).toHaveBeenCalledWith({invoiceId:'invoice'});
  expect(screen.getByText('payment_request:request-real')).toBeVisible();
  expect(screen.getByText('payment_batch:batch-real')).toBeVisible();
  expect(screen.queryByText('payment_request:invoice')).not.toBeInTheDocument();
});

it('retains variance explanations and keeps unmatched payment submission disabled',()=>{
  api.matched=false;show();
  expect(screen.getByRole('button',{name:'提交付款申请'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'三单匹配'}));
  fireEvent.click(screen.getByRole('button',{name:'去处理差异'}));
  fireEvent.change(screen.getByLabelText('差异处理说明'),{target:{value:'待核对收货记录'}});
  fireEvent.click(screen.getByRole('button',{name:'基本信息'}));
  fireEvent.click(screen.getByRole('button',{name:'差异处理'}));
  expect(screen.getByLabelText('差异处理说明')).toHaveValue('待核对收货记录');
  expect(api.submit).not.toHaveBeenCalled();
});

it('retains the existing payment approval submission payload and batch fields',()=>{
  show();fireEvent.click(screen.getByRole('button',{name:'提交付款申请'}));
  fireEvent.change(screen.getByLabelText(/付款批次号/),{target:{value:'PAY-DEMO'}});
  fireEvent.change(screen.getByLabelText('申请备注'),{target:{value:'验收合格后付款'}});
  fireEvent.click(screen.getByRole('button',{name:'确认提交样本'}));
  expect(api.submit).toHaveBeenCalledWith({invoiceId:'invoice',requestStatus:'付款申请审批中',paymentBatchNo:'PAY-DEMO',remark:'验收合格后付款',formData:{reason:'申请说明'}},expect.anything());
});
