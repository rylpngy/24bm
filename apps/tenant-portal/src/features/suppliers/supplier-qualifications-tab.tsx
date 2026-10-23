import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { downloadReport, buyerQualificationArchive } from '@24bid/api-client';
import { ShellState } from '@24bid/ui';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';
import { OwnerAttachments } from '../attachments/owner-attachments';

import { qualificationAlert } from './qualification-status';
import { QualificationReviewPanel } from './qualification-review-panel';
export { qualificationAlert } from './qualification-status';

// 资质证照 Tab:证照台账 + 到期预警 + 附件(营业执照/资质证书/开户许可证)。
export function SupplierQualificationsTab({
  relationId,
  supplierId,
}: {
  relationId: string;
  supplierId?: string;
}) {
  const { can } = useBuyerPermissions();
  const qualifications = useQuery({ queryKey: ['/buyer/suppliers', relationId, 'qualification-archive'], queryFn: () => buyerQualificationArchive(relationId) });
  const quals = qualifications.data ?? [];
  const [downloadError, setDownloadError] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <QualificationReviewPanel relationId={relationId} />
      <div>
        {downloadError && <p role="alert" className="mb-2 text-sm text-red-700">{downloadError}</p>}
        <p className="text-xs font-black text-slate-500">证照台账 · 到期预警</p>
        {qualifications.isLoading ? (
          <ShellState variant="loading" title="加载资质" desc="拉取该供应商的证照…" />
        ) : qualifications.isError ? (
          <div role="alert" className="mt-2 text-sm text-red-700">
            资质加载失败，暂时无法确认资质情况。
            <button type="button" className="ml-3 font-bold underline" onClick={() => void qualifications.refetch()}>重试</button>
          </div>
        ) : quals.length === 0 ? (
          <ShellState
            variant="empty"
            title="暂无资质证照"
            desc="供应商上传或采购方登记的营业执照、资质证书等将列示于此。"
          />
        ) : (
          <div className="mt-2 space-y-2">
            {quals.map((q) => {
              const alert = qualificationAlert(q.expiresAt);
              return (
                <div
                  key={q.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3"
                >
                  <div className="min-w-0">
                    <p className="break-words text-sm font-black text-slate-900">
                      {q.qualificationType}
                      {q.status !== 'active' && <span className="ml-2 text-xs text-slate-500">历史/停用</span>}
                    </p>
                    <p className="mt-0.5 text-xs font-bold text-slate-500">
                      {q.certificateNo} · 到期 {q.expiresAt ?? '—'}
                    </p>
                    {q.fileName && q.id && <button type="button" disabled={downloading !== null}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-600 disabled:opacity-50"
                      onClick={async () => {
                        setDownloadError('');
                        setDownloading(q.id!);
                        try {
                          await downloadReport(`/api/v1/buyer/suppliers/${relationId}/qualifications/${q.id}/download`, q.fileName!);
                        } catch {
                          setDownloadError('原件下载失败，不能据此认定资质已经核验，请重试或联系供应商补传。');
                        } finally { setDownloading(null); }
                      }}><Download size={14} />{downloading === q.id ? '下载中' : '下载原件'}</button>}
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-lg border px-2 py-1 text-xs font-black leading-4 ${q.status === 'active' ? alert.tone : 'border-slate-200 bg-slate-50 text-slate-500'}`}
                  >
                    {q.status === 'active' ? alert.label : '非当前资质'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {supplierId && (
        <OwnerAttachments
          ownerType="supplier"
          ownerId={supplierId}
          title="资质附件"
          readOnly={!can('buyer:supplier:manage')}
          emptyHint="暂无资质附件。"
        />
      )}
    </div>
  );
}
