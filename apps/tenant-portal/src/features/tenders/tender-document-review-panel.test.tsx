import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { TenderDocumentReviewPanel } from './tender-document-review-panel';
const fixture=vi.hoisted(()=>({data:{reviews:[] as Array<{id:string;status:string}>,currentApproved:false},submit:vi.fn()}));
vi.mock('@24bid/api-client',()=>({tenderDocumentReviews:async()=>({data:fixture.data}),submitTenderDocumentReview:(...args:unknown[])=>fixture.submit(...args)}));
vi.mock('../workflow/workflow-instance-panel',()=>({WorkflowStatusPanel:()=> <p>完整审查历史</p>}));
vi.mock('../workflow/workflow-submit-dialog',()=>({WorkflowSubmitDialog:({onSubmit}:{onSubmit:(form:object)=>void})=><button onClick={()=>onSubmit({basis:'规则依据'})}>确认送审</button>}));
afterEach(()=>{cleanup();fixture.data={reviews:[],currentApproved:false};vi.clearAllMocks();});
function show(canManage=true) {return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><TenderDocumentReviewPanel tenderId="t-1" drafting canManage={canManage}/></QueryClientProvider>);}
it('submits configured form fields rather than approving from the business page',async()=>{
  fixture.submit.mockResolvedValue({data:{reviews:[],currentApproved:false}});show();
  await screen.findByText('编制完成后提交独立审查，通过后方可发布。');
  fireEvent.click(screen.getByRole('button',{name:'提交审查'}));
  fireEvent.click(screen.getByRole('button',{name:'确认送审'}));
  await vi.waitFor(()=>expect(fixture.submit).toHaveBeenCalledWith('t-1',{basis:'规则依据'}));
});
it('blocks repeated submission while showing the workflow history',async()=>{
  fixture.data={reviews:[{id:'review-1',status:'processing'}],currentApproved:false};show();
  await screen.findByText('审查中，文件及附件已锁定。');
  expect(screen.getByRole('button',{name:'提交审查'})).toBeDisabled();
  expect(screen.getAllByText('完整审查历史')[0]).toBeVisible();
});
it('requires a new review for a changed document and hides submit for readers',async()=>{
  fixture.data={reviews:[{id:'review-1',status:'approved'}],currentApproved:false};show(false);
  await screen.findByText('文件已变更，发布前须重新审查。');
  expect(screen.queryByRole('button',{name:'提交审查'})).toBeNull();
});
