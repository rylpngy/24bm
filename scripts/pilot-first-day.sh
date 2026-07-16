#!/usr/bin/env bash
# 试点预演:干净环境「客户第一天」全链路验收(在干净库上执行,勿跑在已有数据的环境)。
# 用法:API_BASE=http://localhost:8080 KEYCLOAK_URL=http://localhost:8081 KC_ADMIN_PASSWORD=admin bash scripts/pilot-first-day.sh
# 覆盖:平台开通租户/供应商 → Keycloak 建号(属性+角色) → Excel 导入 → 资质+准入 → 单一来源询价 → 报价→开标→定标→订单→发票→付款。
# 平台开通租户+供应商 → Keycloak 建号 → Excel 导入基础数据 → 需求→询价→报价→定标→订单→发票→付款。
set -euo pipefail
set -o pipefail
API=${API_BASE:-http://localhost:8080}/api/v1
KC=${KEYCLOAK_URL:-http://localhost:8081}
PY='import json,sys'
DRYRUN_DIR="$(cd "$(dirname "$0")" && pwd)"

jqget() { python3 -c "$PY; print(json.load(sys.stdin)$1)"; }
step() { echo "▶ $*"; }
ok()   { echo "  ✓ $*"; }

kctoken() { # $1 username $2 password
  curl -s -X POST "$KC/realms/24bid/protocol/openid-connect/token" \
    -d client_id=24bid-portal -d grant_type=password -d "username=$1" -d "password=$2" \
    | jqget "['access_token']"
}
post() { curl -s -X POST "$API$1" -H "Authorization: Bearer $2" -H 'Content-Type: application/json' -d "$3"; }
postp() { curl -s -X POST "$API$1" -H "Authorization: Bearer $2"; }
put()  { curl -s -X PUT "$API$1" -H "Authorization: Bearer $2" -H 'Content-Type: application/json' -d "$3"; }
get()  { curl -s "$API$1" -H "Authorization: Bearer $2"; }
upload() { curl -s -X POST "$API$1" -H "Authorization: Bearer $2" -H 'Content-Type: application/octet-stream' --data-binary "@$3"; }

step "0) 平台管理员登录(Keycloak realm 静态账号)"
PLAT=$(kctoken platform.admin@example.com demo123456)
[ ${#PLAT} -gt 100 ] && ok "平台管理员 token OK"

step "1) 平台开通采购租户 tenant-pilot + 供应商企业 ent-pilot-supplier"
post /platform/tenants "$PLAT" '{
  "tenantId":"tenant-pilot","enterpriseId":"ent-pilot-buyer","name":"试点采购集团","industry":"综合制造",
  "plan":"MVP","userLimit":50,"enabledFeatures":["rfq","order","finance","contract","mall"],
  "adminName":"试点采购管理员","adminMobile":"13900001111","adminEmail":"owner@pilot.example.com","adminPassword":"pilot-demo-123"
}' | jqget "['data']['id']" >/dev/null && ok "租户已开通"
SUPRES=$(post /platform/suppliers "$PLAT" '{
  "enterpriseId":"ent-pilot-supplier","name":"试点机电设备公司","industry":"机电设备",
  "creditCode":"91310000PILOT001","legalPerson":"张三",
  "adminName":"供应商销售","adminMobile":"13800002222","adminEmail":"sales@pilotsup.example.com","adminPassword":"pilot-demo-123"
}')
echo "$SUPRES" | jqget "['data']['adminUserId']" >/dev/null && ok "供应商已开通: $(echo "$SUPRES" | jqget "['data']['adminUserId']")"

step "2) Keycloak 为两位管理员建号(带 claim 属性)"
KCADM="${KCADM:-docker exec -i 24bid-keycloak /opt/keycloak/bin/kcadm.sh}"
cd "$DRYRUN_DIR"
$KCADM config credentials --server http://localhost:8081 --realm master --user admin --password ${KC_ADMIN_PASSWORD:-admin} >/dev/null
# 守护:unmanagedAttributePolicy 必须为 ENABLED,否则自定义属性(tenantId 等)被丢弃、claim 全空 → 全线 403。
UAP=$($KCADM get realms/24bid/users/profile 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin).get('unmanagedAttributePolicy') or 'DISABLED')")
if [ "$UAP" != "ENABLED" ]; then
  echo "  ✗ realm unmanagedAttributePolicy=$UAP:自定义属性会被丢弃,请先跑 scripts/keycloak-setup.sh 修正"; exit 1
fi
ok "realm 属性策略 ENABLED"
$KCADM create users -r 24bid -s username=owner@pilot.example.com -s enabled=true -s email=owner@pilot.example.com \
  -s emailVerified=true -s firstName=试点 -s lastName=采购管理员 -s 'requiredActions=[]' \
  -s 'attributes.userId=user-tenant-pilot-owner' -s 'attributes.tenantId=tenant-pilot' \
  -s 'attributes.authScope=BUYER' -s 'attributes.displayName=试点采购管理员' >/dev/null 2>&1 || true
$KCADM set-password -r 24bid --username owner@pilot.example.com --new-password pilot-demo-123 >/dev/null
$KCADM add-roles -r 24bid --uusername owner@pilot.example.com --rolename BUYER_OWNER >/dev/null 2>&1 || true
$KCADM create users -r 24bid -s username=sales@pilotsup.example.com -s enabled=true -s email=sales@pilotsup.example.com \
  -s emailVerified=true -s firstName=供应商 -s lastName=销售 -s 'requiredActions=[]' \
  -s 'attributes.userId=user-ent-pilot-supplier-owner' -s 'attributes.supplierId=ent-pilot-supplier' \
  -s 'attributes.authScope=SUPPLIER' -s 'attributes.displayName=供应商销售' >/dev/null 2>&1 || true
$KCADM set-password -r 24bid --username sales@pilotsup.example.com --new-password pilot-demo-123 >/dev/null
$KCADM add-roles -r 24bid --uusername sales@pilotsup.example.com --rolename SUPPLIER_SALES >/dev/null 2>&1 || true
ok "Keycloak 两账号已建"

step "3) 买方/供应商登录"
BUYER=$(kctoken owner@pilot.example.com pilot-demo-123)
SUP=$(kctoken sales@pilotsup.example.com pilot-demo-123)
[ ${#BUYER} -gt 100 ] && [ ${#SUP} -gt 100 ] && ok "双端登录 OK"

step "4) Excel 导入基础数据(部门/物料模板回灌)"
curl -s -o dept.xlsx -H "Authorization: Bearer $BUYER" "$API/buyer/departments/import-template"
upload /buyer/departments/import "$BUYER" dept.xlsx | jqget "['data']['successCount']" | grep -q 2 && ok "部门导入 2 个"
curl -s -o mat.xlsx -H "Authorization: Bearer $BUYER" "$API/buyer/materials/import-template"
upload /buyer/materials/import "$BUYER" mat.xlsx | jqget "['data']['successCount']" | grep -q 1 && ok "物料导入 1 个"
DEPT=$(get /buyer/departments "$BUYER" | python3 -c "$PY; print(json.load(sys.stdin)['data'][0]['id'])")
MAT=$(get /buyer/materials "$BUYER" | python3 -c "$PY; print(json.load(sys.stdin)['data'][0]['id'])")
ok "部门=$DEPT 物料=$MAT"

step "5) 供应商登记资质 → 买方准入(建关系→提交→审批)"
QEXP=$(python3 -c "import datetime;print((datetime.date.today()+datetime.timedelta(days=365)).isoformat())")
post /supplier/qualifications "$SUP" "{\"qualificationType\":\"营业执照\",\"certificateNo\":\"91310000PILOT001\",\"expiresAt\":\"$QEXP\",\"fileName\":\"license.pdf\",\"storageKey\":\"pilot/license.pdf\"}" >/dev/null
ok "供应商资质已登记"
REL=$(post /buyer/suppliers "$BUYER" '{"supplierId":"ent-pilot-supplier","status":"待准入","level":"备选","categories":["机电设备"]}' | jqget "['data']['id']" 2>/dev/null) || \
  REL=$(get /buyer/suppliers "$BUYER" | python3 -c "$PY; print(json.load(sys.stdin)['data'][0]['id'])")
postp "/buyer/suppliers/$REL/submit" "$BUYER" >/dev/null
post "/buyer/suppliers/$REL/approval" "$BUYER" '{"approved":true,"comment":"预演准入"}' >/dev/null
ADM=$(get /buyer/suppliers "$BUYER" | python3 -c "$PY; print(json.load(sys.stdin)['data'][0]['status'])")
[ "$ADM" = "已准入" ] && ok "供应商 $REL 已准入" || { echo "准入失败,状态=$ADM"; exit 1; }

step "6) 需求→审批→询价(草稿→选商→发布)"
DEADLINE=$(python3 -c "import datetime;print((datetime.datetime.now().astimezone()+datetime.timedelta(days=3)).isoformat(timespec='seconds'))")
DEM=$(post /buyer/demands "$BUYER" "{\"title\":\"预演首采需求\",\"departmentId\":\"$DEPT\",\"budget\":50000,\"lineItems\":[{\"materialId\":\"$MAT\",\"quantity\":10}],\"priority\":\"常规\",\"purpose\":\"试点预演\"}" | jqget "['data']['id']")
post "/buyer/demands/$DEM/submit" "$BUYER" '{}' >/dev/null
post "/buyer/demands/$DEM/approval" "$BUYER" '{"approved":true,"comment":"预演同意"}' >/dev/null
ok "需求 $DEM 已通过"
RFQ=$(post /buyer/rfqs "$BUYER" "{\"title\":\"预演首采(单一来源)\",\"demandIds\":[\"$DEM\"],\"invitedSupplierIds\":[],\"deadlineAt\":\"$DEADLINE\",\"evaluationMethod\":\"最低价\",\"method\":\"单一来源\",\"singleSourceReason\":\"试点首采,原有供应商独家适配产线,更换成本过高\",\"saveAsDraft\":true}" | jqget "['data']['id']")
put "/buyer/rfqs/$RFQ/invitations" "$BUYER" '{"supplierIds":["ent-pilot-supplier"]}' >/dev/null 2>&1 || \
  put "/buyer/rfqs/$RFQ/invitations" "$BUYER" '["ent-pilot-supplier"]' >/dev/null
PUB=$(postp "/buyer/rfqs/$RFQ/publish" "$BUYER")
echo "$PUB" | grep -q '"success":true' && ok "RFQ $RFQ 已发布" || { echo "发布失败: $PUB"; exit 1; }

step "7) 供应商报价(按采购清单逐行)→ 买方开标 → 定标 → 订单"
# V179 起报价须依据采购清单:取供应商视角清单行,逐行绑定 demandItemId,数量以清单为准。
QUOTE_BODY=$(get /supplier/rfqs "$SUP" | python3 -c "$PY
d=json.load(sys.stdin)['data']
r=[x for x in d if x['id']=='$RFQ'][0]
items=r.get('items') or []
assert items, '采购清单未下发到供应商(items 为空)'
lines=[{'description':i['materialName'],'unit':i.get('unit') or '项','quantity':i['quantity'],'unitPrice':4800,'demandItemId':i['demandItemId']} for i in items]
total=sum(l['quantity']*l['unitPrice'] for l in lines)
print(json.dumps({'amount':total,'taxRate':13,'deliveryDays':7,'lineItems':lines}))")
QRES=$(post "/supplier/rfqs/$RFQ/quotes" "$SUP" "$QUOTE_BODY")
echo "$QRES" | grep -q '"success":true' || { echo "报价失败: $QRES"; exit 1; }
ok "报价已按清单提交(截止前对买方封存)"
post "/buyer/rfqs/$RFQ/open" "$BUYER" '{"force":true}' >/dev/null
ok "已开标(force,预演提前开标)"
QID=$(get /buyer/rfqs "$BUYER" | python3 -c "$PY
d=json.load(sys.stdin)['data']
r=[x for x in d if x['id']=='$RFQ'][0]
print(r['quotes'][0]['id'])")
AID=$(post "/buyer/rfqs/$RFQ/award" "$BUYER" "{\"quoteId\":\"$QID\",\"reason\":\"预演最低价中标\"}" | jqget "['data']['id']")
post "/buyer/rfqs/$RFQ/award/approval" "$BUYER" "{\"awardId\":\"$AID\",\"approved\":true,\"comment\":\"预演定标同意\"}" >/dev/null
postp "/buyer/rfqs/$RFQ/result/announce" "$BUYER" >/dev/null && ok "结果公告已发布"
RCPT=$(python3 -c "import datetime;print((datetime.date.today()+datetime.timedelta(days=7)).isoformat())")
ORD=$(post /buyer/orders "$BUYER" "{\"awardId\":\"$AID\",\"expectedReceiptDate\":\"$RCPT\"}" | jqget "['data']['id']")
ok "订单 $ORD 已生成"

step "8) 供应商履约 → 买方收货 → 发票 → 付款"
postp "/supplier/orders/$ORD/confirm" "$SUP" >/dev/null
post "/supplier/orders/$ORD/deliveries" "$SUP" '{"carrier":"中通快运","trackingNo":"ZT-PILOT-001","shippedQuantity":10,"logisticsNote":"预演发货"}' >/dev/null
post "/buyer/orders/$ORD/receipts" "$BUYER" '{"result":"验收合格","receivedQuantity":10,"qualifiedQuantity":10,"qualityNote":"预演验收"}' >/dev/null
post "/supplier/orders/$ORD/invoices" "$SUP" '{"amount":48000,"invoiceNo":"INV-PILOT-001","invoiceCode":"144031900001","taxRate":13}' >/dev/null
INV=$(get /buyer/invoices "$BUYER" | python3 -c "$PY
d=json.load(sys.stdin)['data']
print([x for x in d if x['orderId']=='$ORD'][0]['id'])")
post "/buyer/invoices/$INV/payments" "$BUYER" '{"paymentStatus":"已付款"}' >/dev/null
ok "发票 $INV 已付款"

echo "✅ 试点预演闭环通过:租户开通 → Keycloak 建号 → Excel 导入 → 准入 → 询比 → 订单 → 付款"
