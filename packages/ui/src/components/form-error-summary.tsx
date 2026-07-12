import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

export interface FormErrorSummaryProps {
  /** 待改正项列表;为空时不渲染。 */
  errors: string[];
  title?: string;
}

/** 表单错误摘要:提交受阻时的醒目汇总(自动滚动进入视野),配合字段级红字提示使用。 */
export function FormErrorSummary({ errors, title = '还有以下内容需要补充或修正' }: FormErrorSummaryProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (errors.length > 0) {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [errors.length]);

  if (errors.length === 0) return null;
  return (
    <div
      ref={ref}
      role="alert"
      className="rounded-lg border-2 border-red-200 bg-red-50/70 p-4 shadow-sm shadow-red-100/50"
    >
      <p className="flex items-center gap-2 text-sm font-black text-red-700">
        <AlertTriangle size={16} className="shrink-0" />
        {title}({errors.length} 项)
      </p>
      <ul className="mt-2 space-y-1 pl-6">
        {errors.map((e) => (
          <li key={e} className="list-disc text-xs font-bold leading-5 text-red-600">
            {e}
          </li>
        ))}
      </ul>
    </div>
  );
}
