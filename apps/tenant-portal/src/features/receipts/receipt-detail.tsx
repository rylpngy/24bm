import { useState } from 'react';
import type { DeliveryResponse, PurchaseOrderResponse, ReceiptResponse } from '@24bid/api-client';
import { FeedbackNotice, MiniFact, PageHeader, SectionCard, Tabs } from '@24bid/ui';

export function ReceiptDetail({ receipt, order, deliveries, onBack, onReview }: {
  receipt: ReceiptResponse; order?: PurchaseOrderResponse; deliveries: DeliveryResponse[];
  onBack: () => void; onReview: () => void;
}) {
  const [tab, setTab] = useState('info');
  return <div className="min-w-0 space-y-4">
    <PageHeader title="收货验收详情" onBack={onBack} subtitle={`${receipt.id} · 关联订单 ${receipt.orderId ?? '—'}`} />
    <Tabs items={[{id:'info',label:'基本信息'},{id:'items',label:'验收明细'},{id:'quality',label:'质检与处置'},{id:'delivery',label:'关联批次'}]} value={tab} onChange={setTab} />
    <div hidden={tab !== 'info'}><SectionCard title="验收信息"><div className="grid gap-3 sm:grid-cols-3">
      <MiniFact label="验收结论" value={receipt.inspectionConclusion ?? receipt.result ?? '—'} />
      <MiniFact label="验收时间" value={receipt.receivedAt?.replace('T',' ').slice(0,19) ?? '—'} />
      <MiniFact label="验收人" value={receipt.receiverId ?? '—'} />
      <MiniFact label="收货数量" value={String(receipt.receivedQuantity ?? '—')} />
      <MiniFact label="合格数量" value={String(receipt.qualifiedQuantity ?? '—')} />
      <MiniFact label="订单状态" value={order?.status ?? '未读取到关联订单'} />
    </div></SectionCard></div>
    <div hidden={tab !== 'items'}><SectionCard title="逐项验收明细">
      {!receipt.lineItems?.length ? <FeedbackNotice tone="info" message="该验收记录没有保存逐项明细，原始汇总信息仍可在基本信息中查看。" /> : <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm">
        <thead className="bg-slate-50 text-slate-500"><tr>{['品名/规格','订购','收货','合格','合格率'].map(label=><th key={label} className="px-3 py-3">{label}</th>)}</tr></thead>
        <tbody>{receipt.lineItems.map((line,index)=><tr key={line.id ?? index} className="border-b border-slate-100">
          <td className="px-3 py-3 font-bold">{line.description}</td><td className="px-3 py-3">{line.orderedQuantity} {line.unit}</td>
          <td className="px-3 py-3">{line.receivedQuantity}</td><td className="px-3 py-3">{line.qualifiedQuantity}</td>
          <td className="px-3 py-3">{Number(line.receivedQuantity)>0?`${Math.round(Number(line.qualifiedQuantity)/Number(line.receivedQuantity)*100)}%`:'—'}</td>
        </tr>)}</tbody>
      </table></div>}
    </SectionCard></div>
    <div hidden={tab !== 'quality'}><SectionCard title="质检结论与处置">
      <div className="grid gap-3 sm:grid-cols-2"><MiniFact label="验收结论" value={receipt.result ?? '—'} /><MiniFact label="处置方式" value={receipt.disposition ?? '无处置记录'} /></div>
      <p className="mt-4 whitespace-pre-wrap break-words text-sm text-slate-700">验收说明：{receipt.qualityNote || '未登记'}</p>
      {receipt.dispositionNote && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-700">处置说明：{receipt.dispositionNote}</p>}
      {receipt.disposition === '退货换货' && (receipt.qualifiedQuantity ?? 0) < (receipt.receivedQuantity ?? 0) && <button type="button" onClick={onReview} className="mt-4 rounded-md border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-700">处置复核</button>}
    </SectionCard></div>
    <div hidden={tab !== 'delivery'} className="space-y-4">
      {!deliveries.length && <FeedbackNotice tone="info" message="暂无可读取的关联发货批次。" />}
      {deliveries.map(delivery=><SectionCard key={delivery.id} title={`发货批次 ${delivery.id}`}><div className="grid gap-3 sm:grid-cols-3">
        <MiniFact label="承运商" value={delivery.carrier ?? '—'} /><MiniFact label="运单号" value={delivery.trackingNo ?? '—'} /><MiniFact label="发货数量" value={String(delivery.shippedQuantity ?? '—')} />
      </div></SectionCard>)}
      <p className="text-xs text-slate-500">展示关联订单的发货批次，不推断本次验收与某个批次的一一对应关系。</p>
    </div>
  </div>;
}
