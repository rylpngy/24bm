package com.procurement.mall.infrastructure;

import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface MallPurchaseControlMapper {
  record ControlRow(BigDecimal maxCheckoutAmount, String categoryIds, boolean requireAddress) {}
  record Attempt(String requestHash, String response) {}

  @Select("select max_checkout_amount,category_ids::text,require_address from mall_purchase_controls where tenant_id=#{tenant}")
  ControlRow find(String tenant);
  @Insert("insert into mall_purchase_controls(tenant_id) values(#{tenant}) on conflict do nothing")
  void ensure(String tenant);
  @Select("select max_checkout_amount,category_ids::text,require_address from mall_purchase_controls where tenant_id=#{tenant} for update")
  ControlRow lock(String tenant);
  @Update("update mall_purchase_controls set max_checkout_amount=#{amount},category_ids=cast(#{categories} as jsonb),require_address=#{address},updated_by=#{user},updated_at=now() where tenant_id=#{tenant}")
  void save(String tenant, BigDecimal amount, String categories, boolean address, String user);
  @Select("select count(*) from mall_categories where id=#{id} and (tenant_id is null or tenant_id=#{tenant})")
  int visibleCategory(String tenant, String id);
  @Select("<script>select p.id from mall_products p where (p.tenant_id=#{tenant} or p.scope='public') and exists(select 1 from mall_skus s where s.product_id=p.id and s.id in <foreach collection='ids' item='id' open='(' close=')' separator=','>#{id}</foreach>) order by p.id for update</script>")
  List<String> lockProducts(String tenant, @Param("ids") List<String> ids);
  @Select("<script>select s.id from mall_skus s join mall_products p on p.id=s.product_id where (p.tenant_id=#{tenant} or p.scope='public') and s.id in <foreach collection='ids' item='id' open='(' close=')' separator=','>#{id}</foreach> order by s.id for update of s</script>")
  List<String> lockSkus(String tenant, @Param("ids") List<String> ids);
  @Select("""
      select s.id from mall_skus s join mall_products p on p.id=s.product_id
      where s.material_id=#{material} and s.unit=#{unit} and p.status='在架' and s.status='在架'
        and (p.tenant_id=#{tenant} or p.scope='public')
        and exists(select 1 from buyer_supplier_relations bs where bs.tenant_id=#{tenant} and bs.supplier_id=p.supplier_id and bs.status='已准入')
      order by p.id,s.id
      """)
  List<String> comparisonSkus(String tenant, String material, String unit);
  @Insert("insert into mall_checkout_attempts(tenant_id,user_id,idempotency_key,request_hash) values(#{tenant},#{user},#{key},#{hash}) on conflict do nothing")
  void claim(String tenant,String user,String key,String hash);
  @Select("select request_hash,response::text from mall_checkout_attempts where tenant_id=#{tenant} and user_id=#{user} and idempotency_key=#{key} for update")
  Attempt lockAttempt(String tenant,String user,String key);
  @Update("update mall_checkout_attempts set response=cast(#{response} as jsonb) where tenant_id=#{tenant} and user_id=#{user} and idempotency_key=#{key}")
  void complete(String tenant,String user,String key,String response);

  @Insert("insert into mall_order_checkout_notes(order_id,tenant_id,remark) select id,tenant_id,#{remark} from purchase_orders where tenant_id=#{tenant} and id=#{order}")
  int saveCheckoutNote(String tenant,String order,String remark);
  @Select("select remark from mall_order_checkout_notes where tenant_id=#{tenant} and order_id=#{order}")
  String buyerCheckoutNote(String tenant,String order);
  @Select("select n.remark from mall_order_checkout_notes n join purchase_orders p on p.id=n.order_id and p.tenant_id=n.tenant_id where p.supplier_id=#{supplier} and p.id=#{order}")
  String supplierCheckoutNote(String supplier,String order);
}
