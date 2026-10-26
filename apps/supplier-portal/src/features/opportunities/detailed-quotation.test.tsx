import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { afterEach,expect,it,vi } from 'vitest';
import { DetailedQuotation } from './detailed-quotation';
import type { QuotationPackage } from '@24bid/shared/quotation';
const api=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),put:vi.fn()}));
vi.mock('@24bid/api-client',()=>({axiosInstance:api}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
function pack():QuotationPackage{return {policy:{fullQuoteRequired:true,autoExtend:false,extensionHours:24,maxAutoExtensions:1},round:1,deadlineAt:'2099-01-01T00:00:00Z',validQuoteCount:1,sealed:false,extensions:[],files:[{id:'f',fileName:'原件.pdf',contentSize:3,sha256:'x',createdAt:'2026-01-01'}],versions:[{quoteId:'q',versionNo:2,round:1,source:'submitted',createdAt:'2026-01-01',snapshot:{complete:true,quote:{id:'q',supplierId:'s',amount:100,taxRate:0,deliveryDays:7,lineItems:[{demandItemId:'i',description:'设备',unit:'台',quantity:1,unitPrice:100,lineAmount:100}]},details:{invoiceType:'增值税普通发票',attachmentIds:['f'],lines:[{demandItemId:'i',brand:'原品牌',model:'M',technicalParameters:'参数',technicalResponse:'无偏离'}]}}}]};}
function mount(value=pack()){
  render(<QueryClientProvider client={new QueryClient({defaultOptions:{mutations:{retry:false}}})}><DetailedQuotation rfq={{id:'r',status:'报价中',items:[{demandItemId:'i',materialName:'设备',unit:'台',quantity:1}]}} pack={value} onRefresh={vi.fn()} /></QueryClientProvider>);
}
it('sends the captured version and complete line details when editing',async()=>{
  api.put.mockResolvedValue({data:{data:{}}});mount();fireEvent.click(screen.getByRole('button',{name:'修改报价'}));
  fireEvent.change(screen.getByLabelText('品牌1'),{target:{value:'修订品牌'}});
  fireEvent.click(screen.getByRole('button',{name:'确认提交报价'}));
  await waitFor(()=>expect(api.put).toHaveBeenCalledWith('/api/v1/supplier/quotes/q',expect.objectContaining({expectedVersion:2,taxRate:0,amount:100,
    details:expect.objectContaining({lines:[expect.objectContaining({brand:'修订品牌'})]})})));
});
it('retains edits and explains a stale-version rejection',async()=>{
  api.put.mockRejectedValue({response:{data:{message:'报价版本已变化，请刷新'}}});mount();fireEvent.click(screen.getByRole('button',{name:'修改报价'}));
  fireEvent.change(screen.getByLabelText('品牌1'),{target:{value:'仍待提交'}});fireEvent.click(screen.getByRole('button',{name:'确认提交报价'}));
  expect(await screen.findByText('报价版本已变化，请刷新')).toBeVisible();expect(screen.getByLabelText('品牌1')).toHaveValue('仍待提交');
});
it('explains missing mandatory fields without calling the API',async()=>{
  const data=pack();data.versions=[];mount(data);fireEvent.click(screen.getByRole('button',{name:'确认提交报价'}));
  expect(await screen.findByText(/请填写发票类型/)).toBeVisible();expect(api.post).not.toHaveBeenCalled();
});
it('keeps prior-round versions readable before a new round has a quote',()=>{
  const data=pack();data.round=2;mount(data);
  expect(screen.getByRole('button',{name:'第1轮/V2'})).toBeVisible();
  expect(screen.getByText(/第1轮 \/ 版本V2/)).toBeVisible();
  expect(screen.getByLabelText('型号1')).toHaveValue('');
});
