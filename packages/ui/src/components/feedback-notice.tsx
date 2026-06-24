import { type FeedbackTone, feedbackToneClasses, resolveFeedbackTone } from '@24bid/shared';
import { cn } from '../lib/cn';

export interface FeedbackNoticeProps {
  message: string;
  tone?: FeedbackTone;
}

/** 操作反馈条——自动识别成功/失败/信息色调。复刻自现有 FeedbackNotice。 */
export function FeedbackNotice({ message, tone }: FeedbackNoticeProps) {
  const resolved = tone ?? resolveFeedbackTone(message);
  return (
    <div
      aria-live="polite"
      role="status"
      className={cn('rounded-lg border px-4 py-3 text-sm font-bold', feedbackToneClasses[resolved])}
    >
      {message}
    </div>
  );
}
