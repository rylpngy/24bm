import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {describe,it,expect,vi,beforeEach} from 'vitest';
import {AgencyExecutionSnapshot} from './agency-execution-snapshot';
const mocks=vi.hoisted(()=>({request:vi.fn(),download:vi.fn()}));
vi.mock('@24bid/api-client',()=>({executionRequest:mocks.request,agencyFileDownload:mocks.download}));
beforeEach(()=>vi.resetAllMocks());
describe('agency execution frozen review evidence',()=>{
 it('renders frozen plain text and exception context without executing embedded markup',()=>{
  render(<AgencyExecutionSnapshot snapshot={{revisionId:'r1',fileHash:'abc',documentSnapshot:{sections:[{code:'notice',title:'送审公告',body:'<script>bad()</script>'}],fields:{projectTitle:'原项目名'}},completenessIssues:['缺少必需章节内容：合同'],exceptionReason:'有权复核例外'}}/>);
  expect(screen.getByText('<script>bad()</script>')).toBeInTheDocument();
  expect(document.querySelector('script')).toBeNull();expect(screen.getByText('原项目名')).toBeInTheDocument();expect(screen.getByText(/有权复核例外/)).toBeInTheDocument();
 });
 it('downloads the exact revision identity from the review snapshot',async()=>{
  mocks.request.mockResolvedValue({attachmentId:'fixed-att',name:'fixed.docx'});mocks.download.mockResolvedValue(undefined);
  render(<AgencyExecutionSnapshot snapshot={{revisionId:'frozen-r9',fileHash:'abc'}}/>);
  fireEvent.click(screen.getByRole('button',{name:'下载固定送审 DOCX'}));
  await waitFor(()=>expect(mocks.download).toHaveBeenCalledWith('fixed-att','fixed.docx'));expect(mocks.request).toHaveBeenCalledWith('/revisions/frozen-r9/artifact');
 });
 it('shows an access failure without reporting a successful download',async()=>{
  mocks.request.mockRejectedValue(new Error('无权查看受限附件'));
  render(<AgencyExecutionSnapshot snapshot={{revisionId:'restricted-r',fileHash:'abc'}}/>);fireEvent.click(screen.getByRole('button',{name:'下载固定送审 DOCX'}));
  expect(await screen.findByText('无权查看受限附件')).toBeInTheDocument();expect(mocks.download).not.toHaveBeenCalled();
 });
});
