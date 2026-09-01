import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Download, FileText, Upload } from 'lucide-react';
import {
  ActionButton, EmptyState, FeedbackNotice, PrimaryActionButton,
  ResponsiveTableFrame, StatusPill,
} from '@24bid/ui';
import {
  ludongApi, ludongArchiveMaterialCategories,
  type LudongArchiveMaterialCategory,
} from './api';

export function LudongPocArchiveMaterials({
  applicationId,
  readOnly = false,
}: {
  applicationId: string;
  readOnly?: boolean;
}) {
  const client = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<LudongArchiveMaterialCategory>('project_attachment');
  const [error, setError] = useState('');
  const query = useQuery({
    queryKey: ['ludong-poc', 'archive-materials', applicationId],
    queryFn: () => ludongApi.listArchiveMaterials(applicationId),
  });
  const upload = useMutation({
    mutationFn: (file: File) => ludongApi.uploadArchiveMaterial(applicationId, category, file),
    onSuccess: () => {
      setError('');
      client.invalidateQueries({ queryKey: ['ludong-poc', 'archive-materials', applicationId] });
    },
    onError: () => setError('材料上传失败，请确认对象存储服务可用后重试。'),
    onSettled: () => {
      if (fileInput.current) fileInput.current.value = '';
    },
  });
  const materials = query.data ?? [];
  const readyRequired = ludongArchiveMaterialCategories
    .filter((item) => item.required)
    .filter((item) => materials.some((material) => material.category === item.id)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill label={'已归集 ' + materials.length + ' 份'} />
          <span className="text-xs font-bold text-slate-500">
            必备材料 {readyRequired}/3 类
          </span>
          {readyRequired === 3 && (
            <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700">
              <CheckCircle2 size={14} /> 材料齐备
            </span>
          )}
        </div>
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as LudongArchiveMaterialCategory)}
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none focus:border-blue-500"
            >
              {ludongArchiveMaterialCategories.map((item) => (
                <option key={item.id} value={item.id}>{item.label}{item.required ? '（必备）' : ''}</option>
              ))}
            </select>
            <PrimaryActionButton
              icon={Upload}
              disabled={upload.isPending}
              onClick={() => fileInput.current?.click()}
            >
              {upload.isPending ? '上传中' : '上传材料'}
            </PrimaryActionButton>
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload.mutate(file);
              }}
            />
          </div>
        )}
      </div>
      {error && <FeedbackNotice tone="error" message={error} />}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {ludongArchiveMaterialCategories.map((item) => {
          const count = materials.filter((material) => material.category === item.id).length;
          return (
            <div key={item.id} className="rounded-lg border border-slate-200 bg-white px-3 py-3">
              <p className="text-xs font-black text-slate-700">{item.label}</p>
              <p className="mt-1 text-[11px] font-bold text-slate-400">
                {count > 0 ? count + ' 份已归集' : item.required ? '缺少必备材料' : '暂无补充材料'}
              </p>
            </div>
          );
        })}
      </div>
      <ResponsiveTableFrame mobileCards={materials.map((material) => (
        <article key={material.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <StatusPill label={
                ludongArchiveMaterialCategories.find((item) => item.id === material.category)?.label ?? '其他材料'
              } />
              <p className="mt-2 break-words text-sm font-black text-slate-800">{material.fileName}</p>
              <p className="mt-1 text-xs font-bold text-slate-400">
                {material.uploadedBy} · {new Date(material.createdAt).toLocaleString('zh-CN', { hour12: false })}
              </p>
            </div>
            <ActionButton icon={Download} onClick={() => ludongApi.downloadArchiveMaterial(material)}>
              下载
            </ActionButton>
          </div>
        </article>
      ))}>
        <table className="w-full min-w-[760px] table-fixed">
          <thead><tr className="bg-slate-50 text-left text-xs font-black text-slate-500">
            <th className="w-16 px-4 py-3">序号</th>
            <th className="w-36 px-4 py-3">材料分类</th>
            <th className="px-4 py-3">文件名称</th>
            <th className="w-36 px-4 py-3">上传人</th>
            <th className="w-44 px-4 py-3">上传时间</th>
            <th className="w-24 px-4 py-3 text-right">操作</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {materials.map((material, index) => (
              <tr key={material.id} className="text-sm">
                <td className="px-4 py-3 font-bold text-slate-400">{index + 1}</td>
                <td className="px-4 py-3"><StatusPill label={
                  ludongArchiveMaterialCategories.find((item) => item.id === material.category)?.label ?? '其他材料'
                } /></td>
                <td className="truncate px-4 py-3 font-black text-slate-800" title={material.fileName}>
                  {material.fileName}
                </td>
                <td className="truncate px-4 py-3 text-xs font-bold text-slate-500">{material.uploadedBy}</td>
                <td className="px-4 py-3 text-xs font-bold text-slate-500">
                  {new Date(material.createdAt).toLocaleString('zh-CN', { hour12: false })}
                </td>
                <td className="px-4 py-3 text-right">
                  <ActionButton icon={Download} onClick={() => ludongApi.downloadArchiveMaterial(material)}>
                    下载
                  </ActionButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ResponsiveTableFrame>
      {!query.isLoading && materials.length === 0 && (
        <EmptyState
          title="尚未归集原始材料"
          description="请上传项目附件、配置标准和商城确认材料，补充证明可按项目实际情况上传。"
          icon={FileText}
        />
      )}
    </div>
  );
}
