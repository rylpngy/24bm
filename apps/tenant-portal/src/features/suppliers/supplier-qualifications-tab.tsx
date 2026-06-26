import { useBuyerSupplierListRelationQualifications } from '@24bid/api-client';
import { ShellState } from '@24bid/ui';
import { OwnerAttachments } from '../attachments/owner-attachments';

// 资质到期状态:已过期 / 即将到期(30天内) / 正常。
export function qualificationAlert(expiresAt?: string): { label: string; tone: string } {
  if (!expiresAt) return { label: '无到期', tone: 'bg-slate-100 text-slate-600 border-slate-200' };
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: '已过期', tone: 'bg-red-50 text-red-700 border-red-100' };
  if (days <= 30) return { label: `${days}天后到期`, tone: 'bg-amber-50 text-amber-700 border-amber-100' };
  return { label: '正常', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
}

// 资质证照 Tab:证照台账 + 到期预警 + 附件(营业执照/资质证书/开户许可证)。
export function SupplierQualificationsTab({
  relationId,
  supplierId,
}: {
  relationId: string;
  supplierId?: string;
}) {
  const qualifications = useBuyerSupplierListRelationQualifications(relationId);
  const quals = qualifications.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-black text-slate-500">证照台账 · 到期预警</p>
        {qualifications.isLoading ? (
          <ShellState variant="loading" title="加载资质" desc="拉取该供应商的证照…" />
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
                    </p>
                    <p className="mt-0.5 text-xs font-bold text-slate-500">
                      {q.certificateNo} · 到期 {q.expiresAt ?? '—'}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-lg border px-2 py-1 text-xs font-black leading-4 ${alert.tone}`}
                  >
                    {alert.label}
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
          emptyHint="暂无资质附件,点击右上角上传营业执照、资质证书、开户许可证等。"
        />
      )}
    </div>
  );
}
