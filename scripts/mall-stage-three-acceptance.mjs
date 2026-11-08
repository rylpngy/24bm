import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { createAcceptanceQualification } from './acceptance-supplier-qualification.mjs';

function testPng() {
  const crc=bytes=>{let value=0xffffffff;for(const byte of bytes){value^=byte;for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0);}return(value^0xffffffff)>>>0;};
  const chunk=(name,data)=>{const type=Buffer.from(name),length=Buffer.alloc(4),checksum=Buffer.alloc(4);length.writeUInt32BE(data.length);checksum.writeUInt32BE(crc(Buffer.concat([type,data])));return Buffer.concat([length,type,data,checksum]);};
  const header=Buffer.alloc(13);header.writeUInt32BE(32,0);header.writeUInt32BE(32,4);header[8]=8;header[9]=2;
  const pixels=Buffer.alloc(32*(1+32*3),240);for(let y=0;y<32;y++)pixels[y*97]=0;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}

const base=process.env.JAVA_API_BASE_URL;
assert.ok(base && ['127.0.0.1','localhost'].includes(new URL(base).hostname) && new URL(base).port===(process.env.ACCEPTANCE_API_PORT ?? '8095') && new URL(base).port !== '8080'
  && process.env.ACCEPTANCE_LOCAL_WRITES==='1','Explicit isolated 8095 API and ACCEPTANCE_LOCAL_WRITES=1 required; never use original data.');
const required=key=>{assert.ok(process.env[key],`Missing ${key}`);return process.env[key];};
const password=required('ACCEPTANCE_PASSWORD'),supplierId=required('ACCEPTANCE_SUPPLIER_ID');
const id=`mall3-${Date.now()}`;
const report={runId:id,tenantId:id,buyerAccount:`${id}@example.com`,checks:[],records:{},passed:false};
async function api(path,token,data,method=data===undefined?'GET':'POST',expected=[200,201]) {
  const response=await fetch(`${base}/api/v1/${path}`,{method,signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:data===undefined?undefined:JSON.stringify(data)});
  const json=await response.json();assert.ok(expected.includes(response.status),`${method} ${path}: ${response.status} ${JSON.stringify(json)}`);return json.data;
}
const login=(account,scope,context={})=>api('auth/login',null,{account,password,scope,...context});
const check=name=>{report.checks.push(name);console.log(`PASS ${name}`);};
async function approve(b,type,businessId) {
  const task=(await api('buyer/workflow/tasks',b)).find(t=>t.businessType===type && t.businessId===businessId);
  assert.ok(task,`Missing ${type} task`);await api(`buyer/workflow/tasks/${task.taskId}/complete`,b,{action:'approve',comment:'商城阶段真实审核'});
}
try {
  const platform=await login(required('ACCEPTANCE_PLATFORM_ACCOUNT'),'PLATFORM');
  const supplier=await login(required('ACCEPTANCE_SUPPLIER_ACCOUNT'),'SUPPLIER',{supplierId}),s=supplier.accessToken;
  await createAcceptanceQualification(base,s,api,id);
  await api('platform/tenants',platform.accessToken,{tenantId:id,enterpriseId:`ent-${id}`,name:`商城闭环 ${id}`,industry:'通用采购',plan:'MVP',userLimit:20,
    enabledFeatures:['rfq','finance','order','mall','method:mall'],adminName:'商城采购负责人',adminEmail:report.buyerAccount,adminPassword:password});
  const buyer=await login(report.buyerAccount,'BUYER',{tenantId:id}),b=buyer.accessToken;
  const role=(await api('buyer/roles',b)).find(r=>r.permissions.includes('buyer:*'));assert.ok(role);
  for(const businessType of ['buyer_supplier_admission']) {
    const def=await api('buyer/process-definitions',b,{name:`商城审批 ${businessType}`,businessType,icon:'file-text'});
    await api(`buyer/process-definitions/${def.id}`,b,{name:def.name,businessType,status:'draft',formSchema:'{"fields":[]}',flowSchema:JSON.stringify({steps:[{id:'review',type:'approver',title:'准入审核',assignment:{type:'role',roleId:role.id}}]})},'PUT');
    await api(`buyer/process-definitions/${def.id}/publish`,b,{});
  }
  const relation=await api('buyer/suppliers',b,{supplierId,status:'待准入',level:'普通',categories:['通用采购']});
  await api(`buyer/suppliers/${relation.id}/submit`,b,{formData:{}});await approve(b,'buyer_supplier_admission',relation.id);
  const material=await api('buyer/materials',b,{code:`MAT-${id}`,name:'商城采购测试纸张',category:'办公用品',unit:'箱',referencePrice:12.35});
  const category=(await api(`supplier/mall/categories?tenantId=${encodeURIComponent(id)}`,s)).find(c=>c.name==='办公用品');
  assert.ok(category,'A fresh buyer material directory must supply an assignable product category');
  const products=[];
  for(let i=0;i<3;i++) {
    let p=await api('supplier/mall/products',s,{tenantId:id,name:`${id} 复印纸 ${i+1}`,brand:i===2?'品牌B':'品牌A',categoryId:category.id,descriptionHtml:'<p>测试实际商品参数</p>'});
    p=await api(`supplier/mall/products/${p.id}/skus`,s,{skuCode:`SKU-${id}-${i}`,spec:JSON.stringify({规格:i===2?'A3':'A4'}),materialId:material.id,unit:'箱',price:12.35+i,minOrderQty:1,stepQty:1,stockQty:20,leadTimeDays:2,
      tierPrices:[{minQty:5,price:10+i}]});
    if(i===0) {
      const path=`supplier/mall/products/${p.id}/media`;
      let ticket=await api(`${path}/upload-ticket`,s,{fileName:'验收测试图片.png'});
      const image=testPng();
      const upload=bytes=>fetch(`${base}/api/v1/${path}/upload-sink?storageKey=${encodeURIComponent(ticket.storageKey)}&token=${encodeURIComponent(ticket.token)}`,
        {method:'POST',headers:{Authorization:`Bearer ${s}`,'Content-Type':'application/octet-stream'},body:bytes});
      const invalid=await upload(Buffer.from('<svg/>'));assert.equal(invalid.status,400);
      assert.equal((await upload(image)).status,403,'Failed upload attempt must not reuse a claimed ticket');
      ticket=await api(`${path}/upload-ticket`,s,{fileName:'验收测试图片.png'});
      const uploaded=await upload(image);assert.equal(uploaded.status,200,await uploaded.text());
      assert.equal((await upload(image)).status,403);
      const media=await api(path,s,{storageKey:ticket.storageKey});assert.equal(media.length,1);report.records.mediaId=media[0].id;
      await api(path,s,{storageKey:ticket.storageKey},'POST',[403]);
      const oversized=await api(`${path}/upload-ticket`,s,{fileName:'超限图片.png'});
      const stream=new ReadableStream({start(controller){for(let offset=0;offset<5*1024*1024+1;offset+=65536)controller.enqueue(new Uint8Array(Math.min(65536,5*1024*1024+1-offset)));controller.close();}});
      const tooLarge=await fetch(`${base}/api/v1/${path}/upload-sink?storageKey=${encodeURIComponent(oversized.storageKey)}&token=${encodeURIComponent(oversized.token)}`,
        {method:'POST',headers:{Authorization:`Bearer ${s}`,'Content-Type':'application/octet-stream'},body:stream,duplex:'half'});
      assert.equal(tooLarge.status,413,'Chunked upload must fail at the bounded reader without a generic security/error response');
    }
    await api(`supplier/mall/products/${p.id}/status`,s,{status:'待审核'},'PUT');
    if(i===0) assert.equal((await api(`buyer/mall/products/${p.id}/media`,b)).length,1,'Tenant catalog reviewer must see pending images');
    await api(`buyer/mall/products/${p.id}/review`,b,{approved:true,comment:'核对目录、价格及规格'});
    products.push(p);
  }
  const sku=products[0].skus[0].id;report.records.productId=products[0].id;report.records.skuId=sku;
  assert.ok((await api('buyer/mall/categories',b)).some(c=>c.id===category.id));
  assert.equal((await api(`buyer/mall/products?categoryId=${encodeURIComponent(category.id)}`,b)).length,3);
  report.records.categoryId=category.id;
  const imageUrl=`${base}/api/v1/buyer/mall/products/${products[0].id}/media/${report.records.mediaId}/content`;
  assert.equal((await fetch(imageUrl)).status,403);
  const imageResponse=await fetch(imageUrl,{headers:{Authorization:`Bearer ${b}`}});assert.equal(imageResponse.status,200);
  assert.equal(imageResponse.headers.get('content-type'),'image/png');
  assert.equal(Buffer.from(await imageResponse.arrayBuffer()).subarray(1,4).toString(),'PNG');
  check('Real image upload, type validation, one-use ticket, authenticated download and content integrity');
  const comparison=await api(`buyer/mall/comparison?skuId=${sku}&quantity=5`,b);
  assert.equal(comparison.length,3);assert.equal(comparison[0].unitPrice,10);assert.equal(comparison[0].total,50);
  assert.equal(comparison.filter(x=>x.sameSpecification).length,2);
  check('Supplier product/SKU/tier maintenance, real buyer publication and parameter-aware comparison');
  for(const[path,body]of [['orders',{listingId:sku,quantity:1}],['orders/batch',{items:[{listingId:sku,quantity:1}]}],['cart/checkout',{}]]) {
    await api(`buyer/mall/${path}`,b,body,'POST',[400]);
  }
  assert.equal((await api('buyer/orders',b)).length,0);
  await api('buyer/mall/purchase-controls',b,{maxCheckoutAmount:20,categoryIds:[category.id],requireAddress:true,reason:'验证整次结算规则'},'PUT');
  await api('buyer/mall/cart/items',b,{skuId:sku,quantity:2});
  const addresses=await api('buyer/mall/addresses',b,{receiver:'收货负责人',phone:'13800000001',province:'山东省',city:'烟台市',district:'芝罘区',detail:'采购验收中心',isDefault:true});
  const checkout={addressId:addresses[0].id,remark:'请工作日送达，随附清单',idempotencyKey:`${id}-checkout`};
  await api('buyer/mall/cart/checkout',b,checkout,'POST',[400]);
  assert.equal((await api('buyer/orders',b)).length,0);
  await api('buyer/mall/purchase-controls',b,{maxCheckoutAmount:100,categoryIds:[category.id],requireAddress:true,reason:'调整测试限额'},'PUT');
  const pair=await Promise.all([api('buyer/mall/cart/checkout',b,checkout),api('buyer/mall/cart/checkout',b,checkout)]);
  assert.equal(pair[0][0].orderId,pair[1][0].orderId);assert.equal(pair[0][0].amount,24.70);
  const order=(await api('buyer/orders',b))[0];report.records.orderId=order.id;report.records.rfqId=order.rfqId;
  assert.equal((await api('buyer/orders',b)).length,1);assert.equal(order.sourceMethod,'商城');
  assert.equal(await api(`buyer/mall/orders/${order.id}/checkout-note`,b),checkout.remark);
  assert.equal(await api(`supplier/mall/orders/${order.id}/checkout-note`,s),checkout.remark);
  assert.equal((await api('buyer/mall/cart',b)).itemCount,0);
  assert.equal((await api(`buyer/mall/products/${products[0].id}`,b)).skus[0].stockQty,18);
  await api('buyer/mall/cart/checkout',b,{...checkout,remark:'changed'},'POST',[400]);
  check('Whole-checkout limit rolls back, concurrent retries make one order, stock/amount/address/remark preserved');
  await api(`supplier/orders/${order.id}/confirm`,s,{});
  await api(`supplier/orders/${order.id}/deliveries`,s,{carrier:'真实验收物流',trackingNo:`TRACK-${id}`,shippedQuantity:2,lineItems:order.lineItems.map(l=>({orderLineId:l.id,shippedQuantity:l.quantity}))});
  await api(`buyer/orders/${order.id}/receipts`,b,{result:'核对实物及数量，验收合格',receivedQuantity:2,qualifiedQuantity:2,lineItems:order.lineItems.map(l=>({orderLineId:l.id,receivedQuantity:l.quantity,qualifiedQuantity:l.quantity}))});
  const line=order.lineItems[0];
  const cases=await api('buyer/mall/after-sales',b,{orderId:order.id,orderLineId:line.id,type:'维修',quantity:1,reason:'发现设备外观问题'});
  const claim=cases.find(x=>x.orderId===order.id);assert.ok(claim);report.records.afterSalesId=claim.id;
  await api('buyer/mall/after-sales',b,{orderId:order.id,orderLineId:line.id,type:'维修',quantity:2,reason:'超量测试'},'POST',[400]);
  await api(`supplier/mall/after-sales/${claim.id}`,s,{status:'处理中',reply:'已受理'},'PUT');
  const finished=await api(`supplier/mall/after-sales/${claim.id}`,s,{status:'已完成',reply:'检修处理完成',evidenceNo:`SERVICE-${id}`},'PUT');
  assert.equal(finished.find(x=>x.id===claim.id).status,'待买方确认');
  await api(`buyer/mall/after-sales/${claim.id}/confirm`,b,{note:'核实检修结果，确认完成'});
  const history=await api(`buyer/mall/after-sales/${claim.id}/history`,b);assert.equal(history.length,4);assert.ok(history.every(x=>x.actorId));
  await api('buyer/mall/reviews',b,{orderId:order.id,orderLineId:line.id,productId:products[1].id,rating:4,content:'不允许关联其他商品'},'POST',[400]);
  const reviews=await api('buyer/mall/reviews',b,{orderId:order.id,orderLineId:line.id,rating:4,content:'履约和维修已核对'});
  assert.equal(reviews.find(x=>x.orderLineId===line.id).productId,products[0].id);
  check('Unified shipment/receipt, partial aftersales quantity, supplier evidence, buyer confirmation/history and true SKU review binding');
  await api(`supplier/mall/listings/${sku}/price`,s,{price:13.35},'PUT');
  assert.equal((await api('supplier/mall/products',s)).find(p=>p.id===products[0].id).status,'草稿');
  await api('buyer/mall/orders',b,{listingId:sku,quantity:1,idempotencyKey:`${id}-stale`},'POST',[400]);
  await api(`supplier/mall/products/${products[0].id}/status`,s,{status:'待审核'},'PUT');
  await api(`buyer/mall/products/${products[0].id}/review`,b,{approved:true,comment:'调价重新审核'});
  check('Legacy price mutation cannot preserve old publication entitlement; re-review restores purchasability');
  const foreign=await login(required('ACCEPTANCE_FOREIGN_BUYER_ACCOUNT'),'BUYER',{tenantId:required('ACCEPTANCE_FOREIGN_TENANT')});
  await api(`buyer/mall/after-sales/${claim.id}/history`,foreign.accessToken,undefined,'GET',[400,403,404]);
  await api(`buyer/mall/orders/${order.id}/checkout-note`,foreign.accessToken,undefined,'GET',[400,403,404]);
  assert.equal((await fetch(imageUrl,{headers:{Authorization:`Bearer ${foreign.accessToken}`}})).status,403);
  check('Foreign-tenant history and checkout note access denied');
  report.passed=true;
} finally {
  const output=process.env.ACCEPTANCE_RESULT_PATH ?? '/tmp/mall-stage-three.json';mkdirSync(new URL('.',`file://${output}`).pathname,{recursive:true});writeFileSync(output,JSON.stringify(report,null,2));
}
