import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from './http-client';

export type ProductMediaScope = 'buyer' | 'buyer-review' | 'supplier' | 'platform';
export interface ProductMedia {
  id: string; fileName: string; contentType: 'image/png' | 'image/jpeg'; contentSize: number;
  sortOrder: number; main: boolean; contentUrl: string;
}
export interface ProductMediaImage extends ProductMedia { src: string }
export const productMediaPath = (scope: ProductMediaScope, productId: string) =>
  scope === 'buyer-review' ? `/api/v1/buyer/mall/products/${encodeURIComponent(productId)}/review-media` :
    `/api/v1/${scope}/mall/products/${encodeURIComponent(productId)}/media`;

export async function uploadMallProductImage(productId: string, file: File) {
  if (!['image/png', 'image/jpeg'].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024
      || !/\.(png|jpe?g)$/i.test(file.name)) throw new Error('请选择不超过5MB的 PNG/JPEG 商品图片');
  const path = productMediaPath('supplier', productId);
  const { data: { data: ticket } } = await axiosInstance.post<{ data: { storageKey: string; token: string } }>(
    `${path}/upload-ticket`, { fileName: file.name });
  if (!ticket?.storageKey || !ticket.token) throw new Error('未取得有效的图片上传票据');
  // Construct a local endpoint; never send credentials to a response-provided arbitrary URL.
  await axiosInstance.post(`${path}/upload-sink`, await file.arrayBuffer(), {
    params: { storageKey: ticket.storageKey, token: ticket.token }, headers: { 'Content-Type': 'application/octet-stream' },
  });
  return (await axiosInstance.post<{ data: ProductMedia[] }>(path, { storageKey: ticket.storageKey })).data.data;
}

export async function setMallProductMainImage(productId: string, mediaId: string) {
  return (await axiosInstance.put(`${productMediaPath('supplier', productId)}/${encodeURIComponent(mediaId)}/main`)).data;
}
export async function deleteMallProductImage(productId: string, mediaId: string) {
  return (await axiosInstance.delete(`${productMediaPath('supplier', productId)}/${encodeURIComponent(mediaId)}`)).data;
}

export function useMallProductImages(productId: string | undefined, scope: ProductMediaScope, firstOnly = false) {
  const path = productMediaPath(scope, productId ?? '');
  const query = useQuery({ queryKey: [path], enabled: Boolean(productId), retry: false, staleTime: 60_000,
    refetchOnWindowFocus: false, refetchOnReconnect: false, refetchOnMount: false,
    queryFn: async ({ signal }) => (await axiosInstance.get<{ data: ProductMedia[] }>(path, { signal })).data.data });
  const [loaded, setLoaded] = useState<{ path: string; images: ProductMediaImage[]; failed: boolean }>({ path: '', images: [], failed: false });
  useEffect(() => {
    const controller = new AbortController();
    const urls: string[] = [];
    let active = true;
    setLoaded({ path, images: [], failed: false });
    if (query.data && !query.isError && productId) {
      const media = firstOnly ? query.data.slice(0, 1) : query.data;
      void Promise.all(media.map(async item => {
        // Ignore contentUrl and storage keys: download through this exact product/media boundary.
        const response = await axiosInstance.get<Blob>(`${path}/${encodeURIComponent(item.id)}/content`, {
          responseType: 'blob', signal: controller.signal,
        });
        const blob = response.data;
        if (!active) return null;
        if (!['image/png', 'image/jpeg'].includes(blob.type) || blob.size <= 0 || blob.size > 5 * 1024 * 1024) {
          throw new Error('图片响应无效');
        }
        const src = URL.createObjectURL(blob); urls.push(src);
        return { ...item, src };
      })).then(images => {
        if (active) setLoaded({ path, images: images.filter((item): item is ProductMediaImage => item !== null), failed: false });
      }).catch(() => {
        if (active) {
          controller.abort(); urls.forEach(url => URL.revokeObjectURL(url));
          setLoaded({ path, images: [], failed: true }); active = false;
        }
      });
    }
    return () => { active = false; controller.abort(); urls.forEach(url => URL.revokeObjectURL(url)); };
  }, [path, productId, query.data, query.dataUpdatedAt, query.isError, firstOnly]);
  return { query, images: !query.isError && loaded.path === path ? loaded.images : [],
    imageError: loaded.path === path && loaded.failed };
}
