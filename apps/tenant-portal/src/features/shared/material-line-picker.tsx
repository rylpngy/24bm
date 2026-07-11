import { useMemo, useState } from 'react';
import { Search, Trash2 } from 'lucide-react';
import { type MaterialResponse, useMaterialList } from '@24bid/api-client';
import { FeedbackNotice, cn } from '@24bid/ui';

export interface MaterialLine {
  materialId: string;
  quantity: number;
}

const currency = (v?: number) =>
  v == null ? '--' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 0 })}`;

function materialSummary(material?: MaterialResponse) {
  if (!material) return '—';
  return [material.code, material.category, material.specification].filter(Boolean).join(' · ') || '—';
}

// 物料明细选择器:左侧物料库搜索点选,右侧已选表格调数量/删除——与「创建采购需求」页交互一致。
export function MaterialLinePicker({
  rows,
  onChange,
}: {
  rows: MaterialLine[];
  onChange: (rows: MaterialLine[]) => void;
}) {
  const materials = useMaterialList();
  const [searchTerm, setSearchTerm] = useState('');

  const materialList = materials.data?.data ?? [];
  const materialMap = useMemo(() => {
    const map: Record<string, MaterialResponse> = {};
    materialList.forEach((m) => {
      if (m.id) map[m.id] = m;
    });
    return map;
  }, [materialList]);

  const keyword = searchTerm.trim().toLowerCase();
  const filteredMaterials = materialList.filter((m) => {
    if (!keyword) return true;
    return [m.name, m.code, m.category, m.specification]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(keyword);
  });
  const selectedIds = new Set(rows.map((row) => row.materialId).filter(Boolean));
  const total = rows.reduce(
    (sum, row) => sum + (materialMap[row.materialId]?.referencePrice ?? 0) * (row.quantity || 0),
    0,
  );

  const addMaterial = (material: MaterialResponse) => {
    if (!material.id || selectedIds.has(material.id)) return;
    onChange([...rows, { materialId: material.id, quantity: 1 }]);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[22rem_1fr]">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="搜索物料名称、编码、分类、规格"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="mt-3 max-h-[22rem] min-h-[16rem] space-y-2 overflow-y-auto pr-1">
          {materials.isLoading && filteredMaterials.length === 0 ? (
            <FeedbackNotice tone="info" message="正在加载物料清单…" />
          ) : filteredMaterials.length === 0 ? (
            <FeedbackNotice tone="info" message="未找到匹配物料。" />
          ) : (
            filteredMaterials.map((material) => {
              const selected = !!material.id && selectedIds.has(material.id);
              return (
                <button
                  key={material.id ?? material.code ?? material.name}
                  type="button"
                  onClick={() => addMaterial(material)}
                  className={cn(
                    'w-full rounded-lg border bg-white p-3 text-left transition hover:border-blue-200 hover:bg-blue-50/30',
                    selected ? 'border-blue-200 ring-1 ring-blue-100' : 'border-slate-200',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">{material.name}</p>
                      <p className="mt-1 truncate text-xs font-bold text-slate-400">{materialSummary(material)}</p>
                    </div>
                    <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-black text-slate-600">
                      {currency(material.referencePrice)}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold text-slate-400">
          从左侧物料库点选添加;右侧调整数量、查看金额和删除。
        </p>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black text-slate-500">
              <tr>
                <th className="w-14 px-4 py-3">序号</th>
                <th className="px-4 py-3">物料信息</th>
                <th className="w-16 px-4 py-3">单位</th>
                <th className="px-4 py-3 text-right">参考单价</th>
                <th className="w-24 px-4 py-3 text-right">数量</th>
                <th className="px-4 py-3 text-right">预算小计</th>
                <th className="w-16 px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((row, index) => {
                const material = materialMap[row.materialId];
                const amount = material?.referencePrice ? material.referencePrice * (row.quantity || 0) : undefined;
                return (
                  <tr key={`${row.materialId}-${index}`} className="hover:bg-blue-50/30">
                    <td className="px-4 py-4 font-mono font-black text-slate-400">{index + 1}</td>
                    <td className="px-4 py-4">
                      <p className="font-black text-slate-950">{material?.name ?? '物料已失效'}</p>
                      <p className="mt-1 text-xs font-bold text-slate-400">{materialSummary(material)}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-bold text-slate-600">{material?.unit ?? '—'}</td>
                    <td className="px-4 py-4 text-right font-mono font-black text-slate-900">{currency(material?.referencePrice)}</td>
                    <td className="px-4 py-4 text-right">
                      <input
                        className="h-9 w-16 rounded-lg border border-slate-200 bg-white px-2 text-right text-sm font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                        type="number"
                        min={1}
                        value={row.quantity || ''}
                        onChange={(event) => {
                          const next = [...rows];
                          next[index] = { ...next[index], quantity: Number(event.target.value) };
                          onChange(next);
                        }}
                      />
                    </td>
                    <td className="px-4 py-4 text-right font-mono font-black text-slate-900">{currency(amount)}</td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => onChange(rows.filter((_, i) => i !== index))}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="删除物料行"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <p className="text-sm font-black text-slate-700">尚未选择采购物料</p>
                    <p className="mt-1 text-xs font-bold text-slate-400">
                      在左侧搜索物料名称、编码、分类或规格,点击物料卡片后会自动加入明细。
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-slate-50">
              <tr>
                <td colSpan={5} className="px-4 py-3 text-right text-xs font-black text-slate-500">参考预算合计</td>
                <td className="px-4 py-3 text-right font-mono text-lg font-black text-violet-600">{currency(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
