import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from '@24bid/api-client';
import { FeedbackNotice } from '@24bid/ui';

export function OrderCheckoutNote({ orderId }: { orderId: string }) {
  const path=`/api/v1/supplier/mall/orders/${encodeURIComponent(orderId)}/checkout-note`;
  const query=useQuery({queryKey:[path],retry:false,queryFn:async({signal})=>(await axiosInstance.get<{data:string|null}>(path,{signal})).data.data});
  if(query.isError) return <FeedbackNotice tone="error" message="采购方结算备注加载失败，请重新展开订单重试。" />;
  if(!query.data) return null;
  return <section aria-label="采购方结算备注" className="border-l-2 border-blue-300 pl-3 text-xs"><h3 className="font-bold text-slate-700">采购方结算备注</h3><p className="mt-1 whitespace-pre-wrap break-words text-slate-600">{query.data}</p></section>;
}
