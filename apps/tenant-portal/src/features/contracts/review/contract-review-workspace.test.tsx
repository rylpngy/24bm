import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {ContractReviewWorkspace} from './contract-review-workspace';
import type {Workspace,RuleVersion} from './contract-review-api';
const api=vi.hoisted(()=>({get:vi.fn(),post:vi.fn()}));
vi.mock('@24bid/api-client',()=>({axiosInstance:api}));
vi.mock('./contract-rule-editor',()=>({ContractRuleEditor:()=> <div>规则编辑器</div>}));
const rules:RuleVersion[]=[{id:'rules-v1',setId:'set',name:'内部规则',version:1,rules:[],createdBy:'u',createdAt:'2026-10-26T01:00:00Z'}];
function fixture():Workspace{return {document:{id:'doc',fileName:'合同.docx',currentVersion:1,originalSha256:'hash',limitations:[],createdBy:'u',createdAt:'2026-10-26T01:00:00Z'},versions:[{version:1,textSha256:'text',createdBy:'u',createdAt:'2026-10-26T01:00:00Z',segments:[{locator:'paragraph:1',text:'预付100%合同款'}]}],runs:[{id:'run',documentId:'doc',documentVersion:1,rulesVersionId:'rules-v1',perspective:'BUYER',mode:'MODEL_ASSISTED',model:'configured-model',limitation:'须人工复核',findings:[{id:'finding',ruleId:'prepay',title:'预付款风险',severity:'HIGH',origin:'RULE',locator:'paragraph:1',quote:'预付100%合同款',explanation:'复核付款保障',suggestion:'分阶段支付并提供履约保障。',sourceName:'内部依据',clause:'第一条',basis:'复核预付比例。'}],createdBy:'u',actorName:'审核人（001）',createdAt:'2026-10-26T01:00:00Z'}],decisions:[]};}
let value:Workspace;
beforeEach(()=>{
  value=fixture();window.history.replaceState(null,'','/?module=contracts&view=review&reviewDocument=doc');
  HTMLElement.prototype.scrollIntoView=vi.fn();
  api.get.mockImplementation(async(url:string)=>({data:{data:url.endsWith('/rule-versions')?rules:url.includes('/documents?page')?{items:[value.document],total:1,pageSize:10}:value}}));
  api.post.mockResolvedValue({data:{data:{}}});
});
afterEach(()=>{cleanup();vi.resetAllMocks();});
function mount(canManage=true){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><ContractReviewWorkspace canManage={canManage} onBack={vi.fn()}/></QueryClientProvider>);}
it('locates actual original text and shows bound rules and model',async()=>{
  mount();fireEvent.click(await screen.findByRole('button',{name:/定位原文/}));
  expect(screen.getByTestId('source-paragraph:1')).toHaveClass('border-amber-400');
  expect(screen.getByText(/内部规则 · V1/,{selector:'p'})).toBeVisible();expect(screen.getByText('依据：内部依据 / 第一条')).toBeVisible();
});
it('requires human explanation and sends a revision-bound explicit adoption',async()=>{
  mount();fireEvent.click(await screen.findByRole('button',{name:'确认修订'}));
  fireEvent.click(screen.getByRole('button',{name:'确认并留痕'}));expect(await screen.findAllByText(/请填写人工处理说明/)).not.toHaveLength(0);expect(api.post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('人工处理说明'),{target:{value:'经人工核实后采纳'}});fireEvent.click(screen.getByRole('button',{name:'确认并留痕'}));
  await waitFor(()=>expect(api.post).toHaveBeenCalledWith('/api/v1/buyer/contract-review/documents/doc/reviews/run/decisions',expect.objectContaining({findingId:'finding',expectedVersion:1,action:'adopt',comment:'经人工核实后采纳'}),expect.anything()));
});
it('prevents applying stale findings after the document has changed',async()=>{
  value.document.currentVersion=2;mount();expect(await screen.findByRole('button',{name:'确认修订'})).toBeDisabled();expect(screen.getByText(/当前正文已有新版本/)).toBeVisible();
});
it('read-only users have no approval or model execution actions',async()=>{
  mount(false);await screen.findByText('预付款风险');expect(screen.queryByRole('button',{name:'确认修订'})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'规则 + AI审查'})).not.toBeInTheDocument();
});
it('displays immutable human history including before and after text',async()=>{
  value.decisions=[{id:'d',runId:'run',findingId:'finding',action:'adopt',oldVersion:1,newVersion:2,locator:'paragraph:1',beforeText:'预付100%合同款',afterText:'分阶段支付。',comment:'已核实条件',actorId:'u',actorName:'审核人（001）',createdAt:'2026-10-26T01:00:00Z'}];mount();
  fireEvent.click(await screen.findByRole('button',{name:/人工确认历史/}));fireEvent.click(screen.getByText(/已采纳修订 · V1→V2/));
  expect(screen.getByText('处理说明：已核实条件')).toBeVisible();expect(screen.getByText('分阶段支付。')).toBeVisible();
});

it('embedded review keeps the contract URL and does not silently select an unrelated document',async()=>{
  window.history.replaceState(null,'','/?solution=ludong-poc&module=contracts&recordId=c1');
  render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ContractReviewWorkspace embedded contractId="c1" canManage onBack={vi.fn()}/></QueryClientProvider>);
  expect(await screen.findByText('合同.docx')).toBeVisible();
  expect(screen.queryByRole('button',{name:'返回合同台账'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'详情'}));
  expect(await screen.findByText('预付款风险')).toBeVisible();
  expect(window.location.search).toBe('?solution=ludong-poc&module=contracts&recordId=c1');
  expect(api.get).toHaveBeenCalledWith('/api/v1/buyer/contract-review/documents?page=1&pageSize=10&contractId=c1');
  expect(screen.getByRole('button',{name:'规则 + AI审查'})).toBeEnabled();
});
