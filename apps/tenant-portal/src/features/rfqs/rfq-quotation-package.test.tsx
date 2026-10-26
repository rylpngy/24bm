import { cleanup,render,screen,fireEvent } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { afterEach,expect,it,vi } from 'vitest';
import { RfqQuotationPackage } from './rfq-quotation-package';
import type { QuotationPackage } from '@24bid/shared/quotation';
const api=vi.hoisted(()=>({get:vi.fn(),put:vi.fn(),post:vi.fn()}));
vi.mock('@24bid/api-client',()=>({axiosInstance:api}));
vi.mock('../../lib/use-buyer-permissions',()=>({useBuyerPermissions:()=>({can:()=>true})}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
function fixture(sealed=false):QuotationPackage{return {policy:{fullQuoteRequired:true,autoExtend:true,extensionHours:24,maxAutoExtensions:1},round:1,deadlineAt:'2099-01-01T00:00:00Z',validQuoteCount:3,sealed,files:[],extensions:[],versions:sealed?[]:[1,2,3].map(i=>({quoteId:`q${i}`,versionNo:1,round:1,source:'submitted',createdAt:'2026-01-01',snapshot:{complete:true,quote:{id:`q${i}`,supplierId:`s${i}`,amount:100+i,taxRate:13,deliveryDays:10,lineItems:[{demandItemId:'item',description:'采集仪',quantity:1,unit:'套',unitPrice:100+i,lineAmount:100+i}]},details:{invoiceType:'增值税普通发票',attachmentIds:[],lines:[{demandItemId:'item',brand:`品牌${i}`,model:`型号${i}`,technicalParameters:'8通道',technicalResponse:i===3?'接口存在负偏离':'无偏离'}]}}}))};}
function mount(sealed=false){api.get.mockResolvedValue({data:{data:fixture(sealed)}});render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><RfqQuotationPackage rfqId="r" status="已开标" supplierNames={{s1:'甲公司',s2:'乙公司',s3:'丙公司'}} items={[{demandItemId:'item',specification:'须支持开放接口'}]} /></QueryClientProvider>);}
it('shows all suppliers technical responses with the procurement baseline',async()=>{
  mount();expect(await screen.findByText('接口存在负偏离')).toBeVisible();expect(screen.getByText('须支持开放接口')).toBeVisible();
  expect(screen.getByText('品牌1 / 型号1')).toBeVisible();expect(screen.getByText('品牌2 / 型号2')).toBeVisible();
  expect(screen.getByRole('button',{name:'导出比价表'})).toBeEnabled();
});
it('does not expose sealed quotes or enable export',async()=>{
  mount(true);expect(await screen.findByText('报价封存中，开标后可查看逐项技术响应及历史版本。')).toBeVisible();
  expect(screen.getByRole('button',{name:'导出比价表'})).toBeDisabled();expect(screen.queryByText('品牌1 / 型号1')).not.toBeInTheDocument();
});
it('opens a stored version rather than editing its original response',async()=>{
  mount();fireEvent.click(await screen.findByRole('button',{name:'甲公司 · 轮1/V1'}));
  expect(screen.getByText(/提交人：历史未留存/)).toBeVisible();expect(screen.getByText('甲公司 · 第1轮 · V1')).toBeVisible();
});
