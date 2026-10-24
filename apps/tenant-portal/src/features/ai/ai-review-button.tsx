import { lazy, Suspense, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { AiSubjectType } from '@24bid/api-client/ai-reviews';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';

const ReviewPanel = lazy(() => import('./ai-review-panel').then(module => ({ default: module.AiReviewPanel })));

export function AiReviewButton({ subjectType, subjectId }: { subjectType: AiSubjectType; subjectId: string }) {
  const { can } = useBuyerPermissions();
  const [openedSubject, setOpenedSubject] = useState<string>();
  const key = `${subjectType}:${subjectId}`;
  if (!subjectId || !can('buyer:ai:read')) return null;
  return <>
    <button type="button" onClick={() => setOpenedSubject(key)} className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-blue-200 bg-white px-3 text-xs font-bold text-blue-700 hover:bg-blue-50"><Sparkles size={15} />AI辅助评审</button>
    {openedSubject === key && <Suspense fallback={<p role="status" className="text-xs text-slate-500">正在加载评审…</p>}><ReviewPanel key={key} subjectType={subjectType} subjectId={subjectId} onClose={() => setOpenedSubject(undefined)} /></Suspense>}
  </>;
}
