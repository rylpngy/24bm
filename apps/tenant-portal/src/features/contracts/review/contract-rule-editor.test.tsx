import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,expect,it,vi} from 'vitest';
import {ContractRuleEditor} from './contract-rule-editor';
const api=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),put:vi.fn()}));
vi.mock('@24bid/api-client',()=>({axiosInstance:api}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
function mount(){api.get.mockResolvedValue({data:{data:[]}});render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><ContractRuleEditor canManage/></QueryClientProvider>);}
it('publishes only a saved revision and retains explicit example provenance',async()=>{
  api.post.mockResolvedValueOnce({data:{data:{id:'set',name:'采购合同演示规则',revision:1,rules:[]}}}).mockResolvedValueOnce({data:{data:{id:'v1',version:1}}});mount();
  fireEvent.click(screen.getByRole('button',{name:'导入演示规则'}));expect(screen.getByRole('button',{name:'发布新版本'})).toBeDisabled();
  expect(screen.getAllByText('采购合同内部演示规则（非学校正式制度）')).toHaveLength(4);
  fireEvent.click(screen.getByRole('button',{name:'保存草稿'}));await waitFor(()=>expect(screen.getByRole('button',{name:'发布新版本'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button',{name:'发布新版本'}));await waitFor(()=>expect(api.post).toHaveBeenLastCalledWith('/api/v1/buyer/contract-review/rule-sets/set/publish',{expectedRevision:1},expect.anything()));
});
it('an unsaved change disables publishing an old draft',async()=>{
  mount();fireEvent.click(screen.getByRole('button',{name:'导入演示规则'}));fireEvent.change(screen.getByLabelText('规则集名称'),{target:{value:'修订中的规则'}});expect(screen.getByRole('button',{name:'发布新版本'})).toBeDisabled();
});
