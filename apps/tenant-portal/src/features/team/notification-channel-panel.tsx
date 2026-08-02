import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import {
  useBuyerNotificationChannelDeliveries,
  useBuyerNotificationChannelSettings,
  useBuyerNotificationChannelRetry,
  useBuyerNotificationChannelTest,
  useBuyerNotificationChannelUpdateSettings,
} from '@24bid/api-client';
import { FeedbackNotice, Panel } from '@24bid/ui';

const CHANNEL_STYLE: Record<string, string> = {
  站内: 'bg-slate-200 text-slate-600',
  邮件: 'bg-blue-100 text-blue-700',
  Webhook: 'bg-violet-100 text-violet-700',
};
const STATUS_STYLE: Record<string, string> = {
  已发送: 'bg-emerald-100 text-emerald-700',
  已记录: 'bg-slate-200 text-slate-600',
  成功: 'bg-emerald-100 text-emerald-700',
  未配置: 'bg-amber-100 text-amber-700',
  失败: 'bg-red-100 text-red-700',
};

// 多通道通知:配置邮件/Webhook 渠道 + 测试分发 + 投递记录。
export function NotificationChannelPanel() {
  const queryClient = useQueryClient();
  const settings = useBuyerNotificationChannelSettings();
  const deliveries = useBuyerNotificationChannelDeliveries();
  const update = useBuyerNotificationChannelUpdateSettings();
  const test = useBuyerNotificationChannelTest();
  const retry = useBuyerNotificationChannelRetry();
  const [feedback, setFeedback] = useState<string | null>(null);

  const [form, setForm] = useState({
    emailEnabled: false,
    emailRecipient: '',
    webhookEnabled: false,
    webhookUrl: '',
  });

  const loaded = settings.data?.data;
  useEffect(() => {
    if (loaded) {
      setForm({
        emailEnabled: loaded.emailEnabled ?? false,
        emailRecipient: loaded.emailRecipient ?? '',
        webhookEnabled: loaded.webhookEnabled ?? false,
        webhookUrl: loaded.webhookUrl ?? '',
      });
    }
  }, [loaded]);

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' &&
        (q.queryKey[0] as string).includes('notification-channels'),
    });

  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300';

  const onSave = () =>
    update.mutate(
      { data: form },
      { onSuccess: () => { setFeedback('通知渠道已保存。'); refresh(); } },
    );

  const dList = deliveries.data?.data ?? [];

  return (
    <Panel title="通知渠道（多通道）" icon={Bell} subtitle="站内 · 邮件 · Webhook">
      {feedback && (
        <div className="mb-3">
          <FeedbackNotice tone="success" message={feedback} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <label className="flex items-center gap-2 text-sm font-black text-slate-700">
            <input type="checkbox" checked={form.emailEnabled}
              onChange={(e) => setForm((f) => ({ ...f, emailEnabled: e.target.checked }))} />
            邮件通道
          </label>
          <input className={`${inputCls} mt-2`} placeholder="收件邮箱" value={form.emailRecipient}
            onChange={(e) => setForm((f) => ({ ...f, emailRecipient: e.target.value }))} />
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <label className="flex items-center gap-2 text-sm font-black text-slate-700">
            <input type="checkbox" checked={form.webhookEnabled}
              onChange={(e) => setForm((f) => ({ ...f, webhookEnabled: e.target.checked }))} />
            Webhook 通道
          </label>
          <input className={`${inputCls} mt-2`} placeholder="https://…/webhook" value={form.webhookUrl}
            onChange={(e) => setForm((f) => ({ ...f, webhookUrl: e.target.value }))} />
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onSave} disabled={update.isPending}
          className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-xs font-black text-white hover:bg-blue-700 disabled:opacity-50">
          {update.isPending ? '保存中' : '保存配置'}
        </button>
        <button type="button" onClick={() => test.mutate(undefined, { onSuccess: () => { setFeedback('已发起测试分发。'); refresh(); } })}
          disabled={test.isPending}
          className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          {test.isPending ? '分发中' : '测试分发'}
        </button>
      </div>

      <p className="mt-4 text-xs font-black text-slate-500">投递记录</p>
      {dList.length === 0 ? (
        <p className="mt-1 text-[11px] font-bold text-slate-400">暂无投递记录。点「测试分发」体验多通道。</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-lg border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-black text-slate-400">
              <tr>
                <th className="px-3 py-1.5">渠道</th>
                <th className="px-3 py-1.5">目标</th>
                <th className="px-3 py-1.5">标题</th>
                <th className="px-3 py-1.5">结果</th>
                <th className="px-3 py-1.5">时间</th>
                <th className="px-3 py-1.5 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dList.map((d) => (
                <tr key={d.id} className="font-bold text-slate-700">
                  <td className="px-3 py-1.5">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-black ${CHANNEL_STYLE[d.channel ?? ''] ?? 'bg-slate-100'}`}>
                      {d.channel}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 font-mono text-[11px] text-slate-500">{d.target ?? '—'}</td>
                  <td className="px-3 py-1.5">{d.title}</td>
                  <td className="px-3 py-1.5">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-black ${STATUS_STYLE[d.status ?? ''] ?? 'bg-slate-100'}`}>
                      {d.status}
                    </span>
                    {d.detail ? <span className="ml-1 text-[11px] text-slate-400">{d.detail}</span> : null}
                    {d.lastError ? <p className="mt-0.5 text-[11px] font-bold text-red-500">{d.lastError}</p> : null}
                  </td>
                  <td className="px-3 py-1.5 text-[11px] text-slate-400">
                    {d.dispatchedAt?.slice(0, 19).replace('T', ' ')}
                    {(d.attemptCount ?? 1) > 1 && (
                      <span className="ml-1 rounded bg-slate-100 px-1 py-0.5 font-black text-slate-500">第 {d.attemptCount} 次</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {(d.status === '失败' || d.status === '未配置') && d.id && (
                      <button
                        type="button"
                        disabled={retry.isPending}
                        onClick={() => retry.mutate({ deliveryId: d.id! }, {
                          onSuccess: () => {
                            void queryClient.invalidateQueries({
                              predicate: (q) => typeof q.queryKey[0] === 'string'
                                && (q.queryKey[0] as string).includes('/buyer/notification-channels'),
                            });
                          },
                        })}
                        className="inline-flex h-6 items-center rounded border border-slate-200 bg-white px-2 text-[11px] font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        重试
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
