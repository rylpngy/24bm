import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { MallProductDetailPage } from './mall-product-detail-page';
vi.mock('../../lib/use-mall-permissions',()=>({useMallPermissions:()=>({can:()=>true})}));
vi.mock('./buyer-product-images',()=>({BuyerProductImages:()=>null}));
vi.mock('@24bid/api-client',()=>({useBuyerMallProduct:()=>({data:{data:{id:'p',name:'Paper',skus:[{id:'s',status:'在架',price:20,minOrderQty:1,stepQty:1,unit:'箱',leadTimeDays:2}]}}}),useBuyerMallAddToCart:()=>({mutate:vi.fn()})}));
vi.mock('@24bid/api-client/mall-purchasing',()=>({useMallComparison:()=>({data:[{productId:'p2',skuId:'s2',productName:'Same material',supplierName:'Supplier',brand:'Brand',skuCode:'A4',spec:'{}',unit:'箱',unitPrice:10,total:50,leadTimeDays:2,sameSpecification:true}]})}));
afterEach(cleanup);
it('carries comparison quantity into the selected product rather than losing its tier',()=>{
  const navigate=vi.fn();render(<QueryClientProvider client={new QueryClient()}><MallProductDetailPage productId="p" onNavigate={navigate} /></QueryClientProvider>);
  fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'5'}});
  fireEvent.click(screen.getByRole('button',{name:'同目录商品比价'}));
  fireEvent.click(screen.getByRole('button',{name:'查看规格'}));
  expect(navigate).toHaveBeenCalledWith({name:'product',productId:'p2',skuId:'s2',quantity:5});
});
