package com.procurement.mall.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.PermissionService;
import com.procurement.mall.api.*;
import com.procurement.mall.domain.*;
import com.procurement.mall.infrastructure.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.MessageDigest;
import java.util.*;
import java.util.function.Supplier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MallPurchaseControlApplicationService {
  private final MallPurchaseControlMapper mapper;
  private final MallCatalogMapper catalog;
  private final PermissionService permissions;
  private final AuditLogApplicationService audit;
  private final ObjectMapper json;
  private final com.procurement.order.application.OrderAccessService orderAccess;
  public MallPurchaseControlApplicationService(MallPurchaseControlMapper mapper,MallCatalogMapper catalog,
      PermissionService permissions,AuditLogApplicationService audit,ObjectMapper json,
      com.procurement.order.application.OrderAccessService orderAccess) {
    this.mapper=mapper;this.catalog=catalog;this.permissions=permissions;this.audit=audit;this.json=json;
    this.orderAccess=orderAccess;
  }
  public MallPurchaseControl get() {
    permissions.require("buyer:mall:read");
    return decode(mapper.find(TenantAccessGuard.requireTenantId("mall controls")));
  }
  @Transactional public MallPurchaseControl save(SaveMallPurchaseControlRequest request) {
    permissions.require("buyer:mall:manage");
    if(request.reason()==null||request.reason().isBlank()) throw new IllegalArgumentException("请填写采购规则调整依据");
    String tenant=TenantAccessGuard.requireTenantId("mall controls");
    var control=new MallPurchaseControl(request.maxCheckoutAmount(),request.categoryIds(),request.requireAddress());
    for(String category:control.categoryIds()) if(mapper.visibleCategory(tenant,category)!=1) throw new IllegalArgumentException("采购分类不存在或不可见: "+category);
    mapper.ensure(tenant);mapper.lock(tenant);
    mapper.save(tenant,control.maxCheckoutAmount(),encode(control.categoryIds()),control.requireAddress(),TenantAccessGuard.requireUserId("mall controls"));
    audit.recordCurrentTenantAction("mall.controls.updated","mall_control",tenant,request.reason().trim()+"; "+encode(control));
    return control;
  }
  public void requireAllowed(BigDecimal amount,List<String> categoryIds,boolean hasAddress) {
    permissions.require("buyer:mall:purchase");
    String tenant=TenantAccessGuard.requireTenantId("mall controls");
    mapper.ensure(tenant);
    decode(mapper.lock(tenant)).check(amount,categoryIds,hasAddress);
  }
  public void lockCatalog(List<String> skuIds) {
    if(skuIds.isEmpty() || skuIds.size()>200 || skuIds.stream().anyMatch(x->x==null||x.isBlank())) throw new IllegalArgumentException("结算清单无效，最多200项");
    var ids=skuIds.stream().distinct().sorted().toList();
    String tenant=TenantAccessGuard.requireTenantId("mall checkout");
    mapper.lockProducts(tenant,ids);
    if(mapper.lockSkus(tenant,ids).size()!=ids.size()) throw new IllegalArgumentException("商品不存在或不可见，请刷新清单");
  }
  public void saveCheckoutNote(String order,String remark) {
    if(remark==null||remark.isBlank()) return;
    if(remark.length()>2000) throw new IllegalArgumentException("订单备注不能超过2000字");
    if(mapper.saveCheckoutNote(TenantAccessGuard.requireTenantId("mall checkout"),order,remark.trim())!=1)
      throw new IllegalStateException("订单备注保存失败");
  }
  public String buyerCheckoutNote(String order) {
    orderAccess.requireOrder(order,"buyer:order:read");
    return mapper.buyerCheckoutNote(TenantAccessGuard.requireTenantId("mall checkout note"),order);
  }
  public String supplierCheckoutNote(String order) {
    permissions.require("supplier:order:read");
    return mapper.supplierCheckoutNote(TenantAccessGuard.requireSupplierId("mall checkout note"),order);
  }
  public List<MallComparisonRow> compare(String skuId,BigDecimal quantity) {
    permissions.require("buyer:mall:read");
    if(quantity==null||quantity.signum()<=0) throw new IllegalArgumentException("比价数量必须大于0");
    String tenant=TenantAccessGuard.requireTenantId("mall comparison");
    MallSku source=catalog.findSkuForTenant(tenant,skuId);
    if(source==null) throw new IllegalArgumentException("商品不存在或不可见");
    List<MallComparisonRow> rows=new ArrayList<>();
    if(source.materialId()==null) return rows;
    for(String id:mapper.comparisonSkus(tenant,source.materialId(),source.unit())) {
      var sku=catalog.findSkuForTenant(tenant,id);
      if(sku==null) continue;
      var product=catalog.findProductForTenant(tenant,sku.productId());
      try { MallCatalogPolicy.requireOrderable(product,sku,quantity); }
      catch(IllegalArgumentException|IllegalStateException invalid) { continue; }
      var price=MallCatalogPolicy.effectivePrice(sku,catalog.listTiersForTenant(tenant,id),quantity);
      boolean same;
      try {same=json.readTree(source.spec()).equals(json.readTree(sku.spec()));}
      catch(Exception invalid) {same=false;}
      rows.add(new MallComparisonRow(product.id(),id,product.name(),product.brand(),product.supplierName(),sku.skuCode(),sku.spec(),sku.unit(),price,
          price.multiply(quantity).setScale(2,RoundingMode.HALF_UP),sku.leadTimeDays(),sku.stockQty(),same));
    }
    rows.sort(Comparator.comparing(MallComparisonRow::unitPrice).thenComparing(MallComparisonRow::skuId));
    return rows.stream().limit(100).toList();
  }
  @Transactional public List<MallOrderResponse> idempotent(String operation,String key,Object request,Supplier<List<MallOrderResponse>> action) {
    permissions.require("buyer:mall:purchase");
    if(key==null||key.isBlank()) throw new IllegalArgumentException("提交编号不能为空，请重新发起结算");
    if(key.length()>100) throw new IllegalArgumentException("提交编号过长");
    String tenant=TenantAccessGuard.requireTenantId("mall checkout"),user=TenantAccessGuard.requireUserId("mall checkout");
    String hash;
    try {hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest((operation+encode(request)).getBytes(java.nio.charset.StandardCharsets.UTF_8)));}
    catch(Exception error) {throw new IllegalStateException("结算提交校验失败",error);}
    mapper.claim(tenant,user,key,hash);
    var previous=mapper.lockAttempt(tenant,user,key);
    if(!hash.equals(previous.requestHash())) throw new IllegalStateException("相同提交编号对应的结算内容已变化，请重新发起结算");
    if(previous.response()!=null) {
      try {return json.readValue(previous.response(),new TypeReference<List<MallOrderResponse>>(){});}
      catch(Exception error) {throw new IllegalStateException("结算记录读取失败",error);}
    }
    var result=action.get();mapper.complete(tenant,user,key,encode(result));return result;
  }
  private MallPurchaseControl decode(MallPurchaseControlMapper.ControlRow row) {
    if(row==null) return MallPurchaseControl.unrestricted();
    try {return new MallPurchaseControl(row.maxCheckoutAmount(),json.readValue(row.categoryIds(),new TypeReference<List<String>>(){}),row.requireAddress());}
    catch(Exception error) {throw new IllegalStateException("企业采购规则无效，请联系管理员核对",error);}
  }
  private String encode(Object value) {
    try {return json.writeValueAsString(value);} catch(Exception error){throw new IllegalArgumentException("结算数据无法序列化",error);}
  }
}
