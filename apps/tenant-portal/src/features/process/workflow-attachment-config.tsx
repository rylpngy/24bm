import { ActionButton, SectionCard } from '@24bid/ui';
import { Plus, Trash2, Paperclip } from 'lucide-react';

export interface WorkflowAttachmentCategory { id: string; label: string; required: boolean }

export function WorkflowAttachmentConfig({value, catalog, onChange}: {
  value?: WorkflowAttachmentCategory[];
  catalog: WorkflowAttachmentCategory[];
  onChange: (next: WorkflowAttachmentCategory[]) => void;
}) {
  const next = catalog.find((item) => !value?.some((entry) => entry.id === item.id));
  return <SectionCard title="附件要求" icon={Paperclip}>
    {!value ? <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-slate-500">沿用基础附件分类，不拦截提交。</p>
      <ActionButton icon={Plus} onClick={()=>onChange(catalog.slice(0,3).map((item)=>({...item,required:false})))}>配置附件要求</ActionButton>
    </div> : <>
      <div className="space-y-3">{value.map((item,index)=><div key={item.id} className="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-3">
        <input aria-label={`附件分类名称${index+1}`} maxLength={40} value={item.label} className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 px-3 text-sm"
          onChange={(event)=>onChange(value.map((row)=>row.id===item.id?{...row,label:event.target.value}:row))} />
        <label className="flex shrink-0 items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={item.required}
          onChange={(event)=>onChange(value.map((row)=>row.id===item.id?{...row,required:event.target.checked}:row))} />提交必备</label>
        {catalog.findIndex((row)=>row.id===item.id)>=3 && <button type="button" aria-label={`移除${item.label}`} title={`移除${item.label}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600"
          onClick={()=>onChange(value.filter((row)=>row.id!==item.id))}><Trash2 size={15} /></button>}
      </div>)}</div>
      <div className="mt-3 flex justify-end"><ActionButton icon={Plus} disabled={!next} onClick={()=>next&&onChange([...value,{...next}])}>增加材料分类</ActionButton></div>
    </>}
  </SectionCard>;
}
