import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {agencyRequest,executionRequest,agencyFileDownload} from '@24bid/api-client';
import {FileText,Plus,Download} from 'lucide-react';
import {Panel,FeedbackNotice} from '@24bid/ui';
import {ProjectBusinessPage} from './project-business-page';
import {workbenchHref,fieldClass,actionClass,secondaryClass,stateLabels,type DocumentRow} from './workbench-model';
export function DocumentLibraryPage({kind='purchase'}:{kind?:'purchase'|'announcement'}){
 const [keyword,setKeyword]=useState(''),[page,setPage]=useState(1),[error,setError]=useState(''),[busy,setBusy]=useState('');
 const params=new URLSearchParams(location.search),isAnnouncement=kind==='announcement',module=isAnnouncement?'announcements':'documents';
 const edit=!!params.get('recordId')||params.get('action')==='create';
 const q=useQuery({queryKey:['agency-document-library',kind,keyword,page],queryFn:()=>agencyRequest<{items:DocumentRow[];total:number}>('/workbench/documents?'+new URLSearchParams({kind,keyword,page:String(page)})),enabled:!edit});
 const download=async(row:DocumentRow)=>{if(!row.revisionId)return;setBusy(row.revisionId);setError('');try{const a=await executionRequest<{attachmentId:string}>(`/revisions/${row.revisionId}/artifact`);await agencyFileDownload(a.attachmentId,`${row.title}-${isAnnouncement?'公告':'招标文件'}-V${row.inputVersion}.docx`);}catch{setError('文件下载失败，请核对当前权限或重试。');}finally{setBusy('');}};
 if(edit)return <ProjectBusinessPage mode={isAnnouncement?'announcements':'documents'}/>;
 return <Panel title={isAnnouncement?'公告管理':'招标文件库'} icon={FileText} subtitle={isAnnouncement?'跨项目查看公告版本，独立编制、审核与发布':'汇集项目招标文件，管理编制版本与审核状态'}>
 <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><input aria-label="搜索文件项目" className={fieldClass+' min-w-0 sm:w-80'} placeholder="搜索项目名称或编号" value={keyword} onChange={e=>{setKeyword(e.target.value);setPage(1);}}/><a className={actionClass} href={`/?module=${module}&action=create`}><Plus size={16}/>{isAnnouncement?'新建 / 编制公告':'新建 / 编制招标文件'}</a></div>
 {error&&<FeedbackNotice tone="error" message={error}/>}{q.isError?<FeedbackNotice tone="error" message="文件库加载失败，请重试。"/>:q.isPending?<p>正在加载文件库…</p>:!q.data.items.length?<div className="rounded-xl border border-dashed p-10 text-center text-sm text-slate-500">暂无符合条件的文件。可选择项目开始编制。</div>:<div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['所属项目','采购方式','文件版本','审核状态','操作'].map(h=><th className="p-4" key={h}>{h}</th>)}</tr></thead><tbody>{q.data.items.map(row=><tr className="border-t border-slate-100" key={row.revisionId||row.documentId}><td className="p-4"><p className="font-semibold text-slate-900">{row.title}</p><p className="mt-1 text-xs text-slate-500">{row.number||'待编号'}</p></td><td className="p-4">{row.procurementMethod}</td><td className="p-4">{row.revisionId?`V${row.inputVersion}`:'尚未生成稿件'}</td><td className="p-4"><span className="rounded-md bg-slate-100 px-2 py-1 text-xs">{stateLabels[row.revisionStatus||row.status]||row.status}</span></td><td className="p-4"><div className="flex flex-wrap gap-2"><a className={secondaryClass} href={workbenchHref(module,row.packageId)}>查看 / 编制</a>{row.revisionId&&<button className={secondaryClass} disabled={!!busy} onClick={()=>void download(row)}><Download size={14}/>{busy===row.revisionId?'下载中':'下载'}</button>}</div></td></tr>)}</tbody></table></div>}
 <div className="mt-4 flex items-center justify-end gap-3 text-sm text-slate-500"><span>共 {q.data?.total??0} 条文件版本</span><button className={secondaryClass} disabled={page===1} onClick={()=>setPage(page-1)}>上一页</button><span>第 {page} 页</span><button className={secondaryClass} disabled={!q.data||page*15>=q.data.total} onClick={()=>setPage(page+1)}>下一页</button></div>
 </Panel>;
}
