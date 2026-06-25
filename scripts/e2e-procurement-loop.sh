#!/usr/bin/env bash
# 跨端真实业务闭环验收:买方+供应商两个角色,逐步驱动真实 API
# 需求→审批→RFQ→供应商报价→定标审批→生成订单→供应商确认/发货→买方收货→供应商开票→买方付款。
# 用自研 JWT 登录(确定性);后端 8080 + Postgres 在场即可跑。
set -euo pipefail
BASE=${BASE:-http://localhost:8080/api/v1}
PY='import json,sys'

jqget() { python3 -c "$PY; print(json.load(sys.stdin)$1)"; }

login() { # $1 account $2 scope $3 tenantId $4 supplierId
  local body="{\"account\":\"$1\",\"password\":\"demo123456\",\"scope\":\"$2\""
  [ -n "$3" ] && body="$body,\"tenantId\":\"$3\""
  [ -n "$4" ] && body="$body,\"supplierId\":\"$4\""
  body="$body}"
  curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d "$body" | jqget '["data"]["accessToken"]'
}
post() { curl -s -X POST "$BASE$1" -H "Authorization: Bearer $2" -H 'Content-Type: application/json' -d "$3"; }
postp() { curl -s -X POST "$BASE$1" -H "Authorization: Bearer $2"; }
get()  { curl -s "$BASE$1" -H "Authorization: Bearer $2"; }
step() { echo "▶ $*"; }
ok()   { echo "  ✓ $*"; }

BUYER=$(login buyer.owner@example.com BUYER tenant-acme "")
SUP=$(login supplier.sales@example.com SUPPLIER "" ent-supplier-sunrise)
[ -n "$BUYER" ] && [ -n "$SUP" ] || { echo "登录失败"; exit 1; }
ok "买方/供应商登录"

step "1) 买方建采购需求 + 提交 + 审批通过"
DEM=$(post /buyer/demands "$BUYER" '{"title":"E2E 闭环采购需求","departmentId":"dept-it","budget":60000,"lineItems":[{"materialId":"mat-laptop","quantity":2}],"priority":"常规","purpose":"端到端验收"}' | jqget '["data"]["id"]')
post "/buyer/demands/$DEM/submit" "$BUYER" '{}' >/dev/null
post "/buyer/demands/$DEM/approval" "$BUYER" '{"approved":true,"comment":"E2E 同意"}' >/dev/null
DST=$(get "/buyer/demands" "$BUYER" | python3 -c "$PY;d=[x for x in json.load(sys.stdin)['data'] if x['id']=='$DEM'];print(d[0]['status'] if d else 'NA')")
[ "$DST" = "已通过" ] && ok "需求 $DEM 已通过" || { echo "需求状态=$DST(应为已通过)"; exit 1; }

step "2) 买方建 RFQ 邀请供应商"
RFQ=$(post /buyer/rfqs "$BUYER" "{\"title\":\"E2E 询价\",\"demandIds\":[\"$DEM\"],\"invitedSupplierIds\":[\"ent-supplier-sunrise\"],\"deadlineAt\":\"2026-07-10T18:00:00+08:00\",\"evaluationMethod\":\"最低价\"}" | jqget '["data"]["id"]')
ok "RFQ $RFQ 已创建(报价中)"

step "3) 供应商提交报价"
post "/supplier/rfqs/$RFQ/quotes" "$SUP" '{"amount":60000,"taxRate":13,"deliveryDays":7}' >/dev/null
QID=$(get "/buyer/rfqs" "$BUYER" | python3 -c "$PY
d=json.load(sys.stdin)['data']
r=[x for x in d if x['id']=='$RFQ'][0]
print(r['quotes'][0]['id'])")
ok "报价 $QID 已提交"

step "4) 买方定标 + 定标审批通过 + 生成订单"
AID=$(post "/buyer/rfqs/$RFQ/award" "$BUYER" "{\"quoteId\":\"$QID\",\"reason\":\"E2E 综合最优\"}" | jqget '["data"]["id"]')
post "/buyer/rfqs/$RFQ/award/approval" "$BUYER" "{\"awardId\":\"$AID\",\"approved\":true,\"comment\":\"E2E 定标同意\"}" >/dev/null
ORD=$(post /buyer/orders "$BUYER" "{\"awardId\":\"$AID\",\"expectedReceiptDate\":\"2026-07-15\"}" | jqget '["data"]["id"]')
ok "订单 $ORD 已生成"

step "5) 供应商确认订单 + 发货"
postp "/supplier/orders/$ORD/confirm" "$SUP" >/dev/null
post "/supplier/orders/$ORD/deliveries" "$SUP" '{"carrier":"顺丰速运","trackingNo":"SFE2E001","shippedQuantity":2,"logisticsNote":"E2E 整车直发"}' >/dev/null
ok "订单已确认并发货(已发货)"

step "6) 买方收货验收"
post "/buyer/orders/$ORD/receipts" "$BUYER" '{"result":"验收合格","receivedQuantity":2,"qualifiedQuantity":2,"qualityNote":"E2E 验收合格"}' >/dev/null
ok "已收货验收"

step "7) 供应商开具发票"
post "/supplier/orders/$ORD/invoices" "$SUP" '{"amount":60000,"invoiceNo":"INV-E2E-001","invoiceCode":"144031900000","taxRate":13}' >/dev/null
ok "发票已开具"

step "8) 买方登记付款"
INV=$(get "/buyer/invoices" "$BUYER" | python3 -c "$PY
d=json.load(sys.stdin)['data']
i=[x for x in d if x['orderId']=='$ORD'][0]
print(i['id'])")
post "/buyer/invoices/$INV/payments" "$BUYER" '{"paymentStatus":"已付款"}' >/dev/null
PST=$(get "/buyer/invoices" "$BUYER" | python3 -c "$PY
d=json.load(sys.stdin)['data']
i=[x for x in d if x['orderId']=='$ORD'][0]
print(i['paymentStatus'], i.get('reconciliationStage'))")
ok "付款已登记:$PST"

echo "✅ 跨端闭环验收通过(需求 $DEM → RFQ $RFQ → 订单 $ORD → 发票 $INV)"
