import { useEffect, useState } from 'react';
import { AlignLeft, Calendar, ChevronDown, GripVertical, Hash, Trash2, Type, Wallet } from 'lucide-react';
import { cn } from '@24bid/ui';
import { FIELD_PALETTE, type FieldType, type FormField, uid } from './types';

const ICONS: Record<FieldType, React.ElementType> = {
  text: Type,
  textarea: AlignLeft,
  number: Hash,
  money: Wallet,
  date: Calendar,
  select: ChevronDown,
};

// 表单设计:左=基础组件面板,中=画布(增/选/删),右=组件属性。
export function FormDesigner({
  fields,
  onChange,
}: {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(fields[0]?.id ?? null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const selected = fields.find((f) => f.id === selectedId) ?? null;

  useEffect(() => {
    setSelectedId((current) =>
      current && fields.some((field) => field.id === current) ? current : fields[0]?.id ?? null);
  }, [fields]);

  const reorder = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const from = fields.findIndex((f) => f.id === fromId);
    const to = fields.findIndex((f) => f.id === toId);
    if (from < 0 || to < 0) return;
    const next = [...fields];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  const addField = (type: FieldType) => {
    const label = FIELD_PALETTE.find((p) => p.type === type)?.label ?? '字段';
    const field: FormField = {
      id: uid('f'),
      type,
      label,
      placeholder: type === 'money' ? '0.00' : type === 'select' ? '请选择' : `请输入${label}`,
      required: false,
      options: type === 'select' ? ['选项一', '选项二'] : undefined,
    };
    onChange([...fields, field]);
    setSelectedId(field.id);
  };
  const patch = (id: string, p: Partial<FormField>) =>
    onChange(fields.map((f) => (f.id === id ? { ...f, ...p } : f)));
  const remove = (id: string) => {
    onChange(fields.filter((f) => f.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  return (
    <div className="grid gap-3 lg:grid-cols-[200px_1fr_280px]">
      {/* 左:组件面板 */}
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="mb-2 px-1 text-xs font-black text-slate-400">基础组件</p>
        <div className="grid grid-cols-2 gap-2">
          {FIELD_PALETTE.map((p) => {
            const Icon = ICONS[p.type];
            return (
              <button
                key={p.type}
                type="button"
                onClick={() => addField(p.type)}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 bg-white py-3 text-xs font-black text-slate-600 transition hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700"
              >
                <Icon size={16} />
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 中:画布 */}
      <div className="min-h-[420px] rounded-xl border border-slate-200 bg-white p-5">
        {fields.length === 0 ? (
          <div className="flex h-full min-h-[360px] items-center justify-center text-sm font-bold text-slate-300">
            从左侧点击组件添加到表单
          </div>
        ) : (
          <div className="space-y-3">
            {fields.map((f) => {
              const on = f.id === selectedId;
              const isOver = overId === f.id && dragId !== f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  draggable
                  onDragStart={(e) => { setDragId(f.id); e.dataTransfer.effectAllowed = 'move'; }}
                  onDragOver={(e) => { e.preventDefault(); if (overId !== f.id) setOverId(f.id); }}
                  onDrop={(e) => { e.preventDefault(); if (dragId) reorder(dragId, f.id); setDragId(null); setOverId(null); }}
                  onDragEnd={() => { setDragId(null); setOverId(null); }}
                  onClick={() => setSelectedId(f.id)}
                  className={cn(
                    'block w-full rounded-lg border bg-white p-3 text-left transition',
                    dragId === f.id && 'opacity-40',
                    isOver && 'border-blue-400 ring-2 ring-blue-100',
                    on && !isOver ? 'border-blue-500 ring-2 ring-blue-100' : !isOver && 'border-slate-200 hover:border-slate-300',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-sm font-black text-slate-800">
                      <GripVertical size={15} className="cursor-grab text-slate-300" />
                      {f.label}
                      {f.required && <span className="ml-1 text-red-500">*</span>}
                    </p>
                    {on && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); remove(f.id); }}
                        className="text-slate-300 hover:text-red-500"
                      >
                        <Trash2 size={15} />
                      </span>
                    )}
                  </div>
                  <FieldPreview field={f} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 右:属性 */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-xs font-black text-slate-400">组件属性</p>
        {!selected ? (
          <p className="text-xs font-bold text-slate-400">选择中间的组件以编辑属性。</p>
        ) : (
          <div className="space-y-3">
            <Prop label="标题">
              <input className={inputCls} value={selected.label} onChange={(e) => patch(selected.id, { label: e.target.value })} />
            </Prop>
            {selected.type !== 'select' && (
              <Prop label="提示文字">
                <input className={inputCls} value={selected.placeholder ?? ''} onChange={(e) => patch(selected.id, { placeholder: e.target.value })} />
              </Prop>
            )}
            {selected.type === 'select' && (
              <Prop label="选项(每行一个)">
                <textarea
                  className={`${inputCls} min-h-[80px]`}
                  value={(selected.options ?? []).join('\n')}
                  onChange={(e) => patch(selected.id, { options: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })}
                />
              </Prop>
            )}
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <input type="checkbox" checked={!!selected.required} onChange={(e) => patch(selected.id, { required: e.target.checked })} />
              必填项
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-black text-slate-500">{label}</p>
      {children}
    </div>
  );
}

function FieldPreview({ field }: { field: FormField }) {
  const cls = 'mt-2 w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm font-semibold text-slate-400';
  if (field.type === 'textarea') return <div className={`${cls} min-h-[44px]`}>{field.placeholder}</div>;
  if (field.type === 'select') return <div className={cls}>{field.placeholder} ▾</div>;
  return <div className={cls}>{field.placeholder}</div>;
}
