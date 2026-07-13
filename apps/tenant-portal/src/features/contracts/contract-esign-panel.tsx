import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PenLine, ShieldCheck } from 'lucide-react';
import { useBuyerEsignList, useBuyerEsignSign } from '@24bid/api-client';
import { EsignRecordList, FeedbackNotice, SignaturePad } from '@24bid/ui';
import { useAuthStore } from '../../lib/auth-store';

// 合同电子签章:采购方在线签章留痕(签署人/时间/合同内容指纹/手写笔迹)。
// 供应商报价单签署在供应商端完成;本面板展示该合同下全部签署记录。
export function ContractEsignPanel({ contractId }: { contractId: string }) {
  const queryClient = useQueryClient();
  const displayName = useAuthStore((s) => s.session?.displayName ?? '');
  const records = useBuyerEsignList({ targetType: 'contract', targetId: contractId });
  const sign = useBuyerEsignSign();
  const [signing, setSigning] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = records.data?.data ?? [];
  const buyerSigned = list.some((r) => r.signerScope === 'BUYER');

  const submit = () => {
    if (!signature) {
      setError('请先在签名板上手写签名。');
      return;
    }
    setError(null);
    sign.mutate(
      { data: { targetType: 'contract', targetId: contractId, signatureImage: signature, signerName: displayName } },
      {
        onSuccess: () => {
          setSigning(false);
          setSignature(null);
          void queryClient.invalidateQueries({
            predicate: (q) =>
              typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/buyer/esign-records'),
          });
        },
        onError: (e) =>
          setError(
            (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '签章失败,请稍后重试',
          ),
      },
    );
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-black text-slate-950">
          <ShieldCheck size={16} className="text-emerald-600" /> 电子签章
        </h3>
        {!signing && (
          <button
            type="button"
            onClick={() => setSigning(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-xs font-black text-white transition hover:bg-emerald-700"
          >
            <PenLine size={14} /> {buyerSigned ? '重新签章' : '在线签章'}
          </button>
        )}
      </div>
      <p className="mt-1 text-xs font-bold text-slate-400">
        签章时按合同关键条款生成内容指纹(SHA-256)一并归档,后续可核验合同是否被篡改。
      </p>

      <div className="mt-3">
        {records.isLoading ? (
          <p className="text-xs font-bold text-slate-400">加载签署记录…</p>
        ) : (
          <EsignRecordList records={list} />
        )}
      </div>
      {!buyerSigned && !records.isLoading && (
        <div className="mt-2">
          <FeedbackNotice tone="info" message="本合同采购方尚未电子签章,建议在合同生效前完成签章留痕。" />
        </div>
      )}

      {signing && (
        <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
          <p className="text-xs font-black text-emerald-800">采购方在线签章</p>
          <SignaturePad className="mt-2" onChange={setSignature} />
          {error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={sign.isPending || !signature}
              className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-4 text-xs font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {sign.isPending ? '签章中…' : '确认签章'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSigning(false);
                setSignature(null);
                setError(null);
              }}
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-slate-50"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
