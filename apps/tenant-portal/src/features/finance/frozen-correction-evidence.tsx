import { FeedbackNotice } from '@24bid/ui';
import { projectMoney } from '../projects/project-dialog';
import { FundingRestorationEvidence } from './funded-correction-targets';

export function FrozenCorrectionEvidence({ snapshot }: { snapshot?: string }) {
  if (!snapshot) return null;
  try {
    const data = JSON.parse(snapshot);
    const original = data.original;
    if (!original || !Array.isArray(data.entries)) return null;
    const remaining =
      data.remainingAmount ??
      original.amount +
        data.entries
          .filter(
            (entry: { reversalOf?: string }) =>
              entry.reversalOf === original.id,
          )
          .reduce(
            (sum: number, entry: { amount: number }) => sum + entry.amount,
            0,
          );
    const amount = data.correctionAmount ?? remaining;
    return (
      <section
        aria-label="送审更正金额依据"
        className="space-y-3 border-t border-slate-200 pt-3"
      >
        <h3 className="text-sm font-bold">送审更正金额依据</h3>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {[
            ['原付款金额', original.amount],
            ['送审时可更正余额', remaining],
            ['本次更正金额', amount],
            [
              '本次批准后原流水剩余',
              Math.round((remaining - amount) * 100) / 100,
            ],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt className="text-slate-500">{label}</dt>
              <dd className="mt-1 font-medium">
                {projectMoney(Number(value))}
              </dd>
            </div>
          ))}
        </dl>
        <FundingRestorationEvidence snapshot={snapshot} />
      </section>
    );
  } catch {
    return (
      <FeedbackNotice
        tone="error"
        message="送审金额依据读取失败，请刷新或核对原申请。"
      />
    );
  }
}
