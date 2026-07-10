#!/usr/bin/env bash
# 配置 24bid Keycloak realm:client + roles + protocol mappers + 三端演示用户。
# 令牌 claim 形状对齐后端 AuthenticatedPrincipal(userId/displayName/authScope/tenantId/supplierId/roles)。
set -euo pipefail
KC=${KC:-http://localhost:8081}
REALM=24bid
CLIENT=24bid-portal

admin_token() {
  curl -s -X POST "$KC/realms/master/protocol/openid-connect/token" \
    -d 'grant_type=password' -d 'client_id=admin-cli' \
    -d 'username=admin' -d 'password=admin' | python3 -c 'import json,sys;print(json.load(sys.stdin)["access_token"])'
}
TOK=$(admin_token)
H=(-H "Authorization: Bearer $TOK" -H 'Content-Type: application/json')

echo "== realm =="
curl -s "${H[@]}" -X POST "$KC/admin/realms" -d "{\"realm\":\"$REALM\",\"enabled\":true}" -o /dev/null -w '%{http_code}\n' || true

echo "== client =="
curl -s "${H[@]}" -X POST "$KC/admin/realms/$REALM/clients" -d "{
  \"clientId\":\"$CLIENT\",\"enabled\":true,\"publicClient\":true,
  \"directAccessGrantsEnabled\":true,\"standardFlowEnabled\":true,
  \"redirectUris\":[\"http://localhost:5173/*\",\"http://localhost:5174/*\",\"http://localhost:5175/*\"],
  \"webOrigins\":[\"http://localhost:5173\",\"http://localhost:5174\",\"http://localhost:5175\",\"+\"]
}" -o /dev/null -w '%{http_code}\n' || true

# client uuid
CID=$(curl -s "${H[@]}" "$KC/admin/realms/$REALM/clients?clientId=$CLIENT" | python3 -c 'import json,sys;print(json.load(sys.stdin)[0]["id"])')

echo "== roles =="
for r in BUYER_OWNER PLATFORM_ADMIN SUPPLIER_SALES; do
  curl -s "${H[@]}" -X POST "$KC/admin/realms/$REALM/roles" -d "{\"name\":\"$r\"}" -o /dev/null -w "$r %{http_code}\n" || true
done

echo "== protocol mappers (user attribute -> claim) =="
add_attr_mapper() { # $1 attr  $2 claim
  curl -s "${H[@]}" -X POST "$KC/admin/realms/$REALM/clients/$CID/protocol-mappers/models" -d "{
    \"name\":\"$2\",\"protocol\":\"openid-connect\",\"protocolMapper\":\"oidc-usermodel-attribute-mapper\",
    \"config\":{\"user.attribute\":\"$1\",\"claim.name\":\"$2\",\"jsonType.label\":\"String\",
      \"access.token.claim\":\"true\",\"id.token.claim\":\"true\"}}" -o /dev/null -w "$2 %{http_code}\n" || true
}
add_attr_mapper user_id userId
add_attr_mapper display_name displayName
add_attr_mapper auth_scope authScope
add_attr_mapper tenant_id tenantId
add_attr_mapper supplier_id supplierId
# realm roles -> roles claim (multivalued)
curl -s "${H[@]}" -X POST "$KC/admin/realms/$REALM/clients/$CID/protocol-mappers/models" -d '{
  "name":"roles","protocol":"openid-connect","protocolMapper":"oidc-usermodel-realm-role-mapper",
  "config":{"claim.name":"roles","jsonType.label":"String","multivalued":"true",
    "access.token.claim":"true","id.token.claim":"true"}}' -o /dev/null -w "roles %{http_code}\n" || true

create_user() { # $1 email  $2 user_id  $3 display  $4 scope  $5 tenant  $6 supplier  $7 role
  curl -s "${H[@]}" -X POST "$KC/admin/realms/$REALM/users" -d "{
    \"username\":\"$1\",\"email\":\"$1\",\"firstName\":\"24Bid\",\"lastName\":\"User\",\"enabled\":true,\"emailVerified\":true,
    \"attributes\":{\"user_id\":[\"$2\"],\"display_name\":[\"$3\"],\"auth_scope\":[\"$4\"],\"tenant_id\":[\"$5\"],\"supplier_id\":[\"$6\"]},
    \"credentials\":[{\"type\":\"password\",\"value\":\"demo123456\",\"temporary\":false}]
  }" -o /dev/null -w "user $1 %{http_code}\n" || true
  UID_=$(curl -s "${H[@]}" "$KC/admin/realms/$REALM/users?username=$1" | python3 -c 'import json,sys;print(json.load(sys.stdin)[0]["id"])')
  RID=$(curl -s "${H[@]}" "$KC/admin/realms/$REALM/roles/$7" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["id"]+"|"+d["name"])')
  ROLE_ID=${RID%%|*}; ROLE_NAME=${RID##*|}
  curl -s "${H[@]}" -X POST "$KC/admin/realms/$REALM/users/$UID_/role-mappings/realm" \
    -d "[{\"id\":\"$ROLE_ID\",\"name\":\"$ROLE_NAME\"}]" -o /dev/null -w "  role->$7 %{http_code}\n" || true
}

echo "== users =="
create_user buyer.owner@example.com     user-buyer-owner    采购负责人 BUYER    tenant-acme ""                   BUYER_OWNER
create_user platform.admin@example.com  user-platform-admin 平台运营   PLATFORM ""          ""                   PLATFORM_ADMIN
create_user supplier.sales@example.com  user-supplier-sales 供应商销售 SUPPLIER ""          ent-supplier-sunrise SUPPLIER_SALES

echo "DONE"

# KC 26 需放开非托管属性 + 关闭会阻断 direct-grant 的 profile/email 校验动作。
curl -s "${H[@]}" "$KC/admin/realms/$REALM/users/profile" \
  | python3 -c 'import json,sys;p=json.load(sys.stdin);p["unmanagedAttributePolicy"]="ENABLED";print(json.dumps(p))' \
  | curl -s "${H[@]}" -X PUT "$KC/admin/realms/$REALM/users/profile" -d @- -o /dev/null -w 'unmanaged ENABLED %{http_code}\n' || true
for a in VERIFY_PROFILE VERIFY_EMAIL UPDATE_PROFILE UPDATE_PASSWORD CONFIGURE_TOTP; do
  curl -s "${H[@]}" -X PUT "$KC/admin/realms/$REALM/authentication/required-actions/$a" \
    -d "{\"alias\":\"$a\",\"name\":\"$a\",\"providerId\":\"$a\",\"enabled\":false,\"defaultAction\":false,\"priority\":10,\"config\":{}}" -o /dev/null -w "disable $a %{http_code}\n" || true
done
