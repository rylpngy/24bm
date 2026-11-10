import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base = 'http://127.0.0.1:18080';
async function req(path, method='GET', body, token) {
  const r=await fetch(base+path,{method,headers:{...(token?{authorization:`Bearer ${token}`} : {}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  assert.equal(r.ok,true,`${method} ${path}: HTTP ${r.status}`);
  const p=await r.json(); assert.equal(p.success,true); return p.data;
}
const buyer=await req('/api/v1/auth/login','POST',{account:'buyer.owner@example.com',password:'demo123456',scope:'BUYER',tenantId:'tenant-acme'});
const token=buyer.accessToken;
const demands=await req('/api/v1/buyer/demands','GET',undefined,token);
assert.ok(Array.isArray(demands)&&demands.length>0);
const ownerId=demands[0].id;
const body={ownerType:'purchase_demand',ownerId,fileName:'p0-upload.txt',visibility:'buyer_internal'};
const ticket=await req('/api/v1/buyer/attachments/upload-ticket','POST',body,token);
const bytes=Buffer.from('24Bm P0 attachment byte roundtrip\n中文上传下载验证\n');
const upload=await fetch(base+ticket.uploadUrl,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/octet-stream'},body:bytes});
assert.equal(upload.ok,true,`upload: ${upload.status}`);
const attachment=await req('/api/v1/buyer/attachments','POST',{...body,storageKey:ticket.storageKey},token);
const link=await req(`/api/v1/buyer/attachments/${attachment.id}/download-link`,'POST',undefined,token);
const url=new URL(link.downloadUrl,base); assert.equal(url.origin,base);
const download=await fetch(url,{headers:{authorization:`Bearer ${token}`}}); assert.equal(download.ok,true);
assert.deepEqual(Buffer.from(await download.arrayBuffer()),bytes);
const supplier=await req('/api/v1/auth/login','POST',{account:'supplier.sales@example.com',password:'demo123456',scope:'SUPPLIER',supplierId:'ent-supplier-sunrise'});
const denied=await fetch(base+`/api/v1/buyer/attachments/${attachment.id}/download`,{headers:{authorization:`Bearer ${supplier.accessToken}`}}); assert.equal(denied.status,403);
console.log(JSON.stringify({checks:['buyer login','upload ticket','actual byte upload','metadata registration','download link','byte equality','supplier denied'],sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length},null,2));
