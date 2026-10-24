package com.procurement.mall.infrastructure;

import com.procurement.mall.domain.MallAfterSales;
import com.procurement.mall.domain.MallAfterSalesEvent;
import com.procurement.mall.domain.MallReview;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/** 售后与评价(M-4)。买方按租户维度读写,供应商按 supplier 维度读写,SQL 层各自限定。 */
@Mapper
public interface MallServiceMapper {

  @Select("select id from purchase_orders where tenant_id=#{tenantId} and id=#{orderId} for update")
  @Options(flushCache = Options.FlushCachePolicy.TRUE, useCache = false)
  String lockOrder(@Param("tenantId") String tenantId, @Param("orderId") String orderId);

  @Select("""
      select coalesce(sum(quantity),0) from mall_after_sales
      where tenant_id=#{tenantId} and order_line_id=#{orderLineId}
        and status not in ('已拒绝','已撤回')
      """)
  BigDecimal claimedQuantity(@Param("tenantId") String tenantId, @Param("orderLineId") String orderLineId);

  @Select("""
      select p.id from order_line_items l
      join mall_skus s on s.id=l.source_sku_id
      join mall_products p on p.id=s.product_id
      where l.tenant_id=#{tenantId} and l.order_id=#{orderId} and l.id=#{lineId}
      """)
  String sourceProduct(@Param("tenantId") String tenantId, @Param("orderId") String orderId,
      @Param("lineId") String lineId);

  @Select("""
      select
      """ + AFTER_SALES_COLUMNS + """
      from mall_after_sales a join enterprises e on e.id=a.supplier_id
      where a.tenant_id=#{tenantId} and a.id=#{id}
      """)
  MallAfterSales findForBuyer(@Param("tenantId") String tenantId, @Param("id") String id);

  @Update("""
      update mall_after_sales set status=#{status}, updated_at=now()
      where tenant_id=#{tenantId} and id=#{id} and status=#{expectedStatus}
      """)
  int buyerTransition(@Param("tenantId") String tenantId, @Param("id") String id,
      @Param("expectedStatus") String expectedStatus, @Param("status") String status);

  @Insert("""
      insert into mall_after_sales_events
        (id,after_sales_id,actor_id,actor_role,from_status,to_status,note,evidence_no)
      values (#{id},#{afterSalesId},#{actorId},#{actorRole},#{fromStatus},#{toStatus},#{note},#{evidenceNo})
      """)
  void insertEvent(@Param("id") String id, @Param("afterSalesId") String afterSalesId,
      @Param("actorId") String actorId, @Param("actorRole") String actorRole,
      @Param("fromStatus") String fromStatus, @Param("toStatus") String toStatus,
      @Param("note") String note, @Param("evidenceNo") String evidenceNo);

  @Select("""
      select e.id,e.after_sales_id,e.actor_id,e.actor_role,e.from_status,e.to_status,e.note,e.evidence_no,e.created_at
      from mall_after_sales_events e join mall_after_sales a on a.id=e.after_sales_id
      where e.after_sales_id=#{id} and (a.tenant_id=#{tenantId} or a.supplier_id=#{supplierId})
      order by e.created_at,e.id
      """)
  List<MallAfterSalesEvent> history(@Param("tenantId") String tenantId,
      @Param("supplierId") String supplierId, @Param("id") String id);

  String AFTER_SALES_COLUMNS = """
      a.id, a.tenant_id, a.order_id, a.order_line_id, a.supplier_id, e.name as supplier_name,
      a.type, a.quantity, a.reason, a.status, a.supplier_reply, a.created_at, a.updated_at
      """;

  @Select("select " + AFTER_SALES_COLUMNS + """
      from mall_after_sales a join enterprises e on e.id=a.supplier_id
      where a.tenant_id=#{tenantId} and a.id=#{id} for update of a
      """)
  @Options(flushCache = Options.FlushCachePolicy.TRUE, useCache = false)
  MallAfterSales lockForBuyer(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("select " + AFTER_SALES_COLUMNS + """
      from mall_after_sales a join enterprises e on e.id=a.supplier_id
      where a.supplier_id=#{supplierId} and a.id=#{id} for update of a
      """)
  @Options(flushCache = Options.FlushCachePolicy.TRUE, useCache = false)
  MallAfterSales lockForSupplier(@Param("supplierId") String supplierId, @Param("id") String id);

  @Select("""
      select
      """ + AFTER_SALES_COLUMNS + """
      from mall_after_sales a
      join enterprises e on e.id = a.supplier_id
      where a.tenant_id = #{tenantId}
      order by a.created_at desc
      """)
  List<MallAfterSales> listByTenant(@Param("tenantId") String tenantId);

  @Select("""
      select
      """ + AFTER_SALES_COLUMNS + """
      from mall_after_sales a
      join enterprises e on e.id = a.supplier_id
      where a.supplier_id = #{supplierId}
      order by a.created_at desc
      """)
  List<MallAfterSales> listBySupplier(@Param("supplierId") String supplierId);

  @Insert("""
      insert into mall_after_sales (
        id, tenant_id, order_id, order_line_id, supplier_id, type, quantity, reason, status)
      values (
        #{id}, #{tenantId}, #{orderId}, #{orderLineId}, #{supplierId}, #{type}, #{quantity},
        #{reason}, '待处理')
      """)
  void insertAfterSales(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("orderId") String orderId,
      @Param("orderLineId") String orderLineId,
      @Param("supplierId") String supplierId,
      @Param("type") String type,
      @Param("quantity") BigDecimal quantity,
      @Param("reason") String reason);

  @Select("""
      select
      """ + AFTER_SALES_COLUMNS + """
      from mall_after_sales a
      join enterprises e on e.id = a.supplier_id
      where a.id = #{id} and a.supplier_id = #{supplierId}
      """)
  MallAfterSales findForSupplier(
      @Param("supplierId") String supplierId, @Param("id") String id);

  @Update("""
      update mall_after_sales set status = #{status}, supplier_reply = #{reply}, updated_at = now()
      where id = #{id} and supplier_id = #{supplierId} and status=#{expectedStatus}
      """)
  int handleBySupplier(
      @Param("id") String id,
      @Param("supplierId") String supplierId,
      @Param("status") String status,
      @Param("reply") String reply,
      @Param("expectedStatus") String expectedStatus);

  // ── 评价 ───────────────────────────────────────────────────
  @Insert("""
      insert into mall_reviews (
        id, tenant_id, order_id, order_line_id, product_id, supplier_id, rating, content)
      values (
        #{id}, #{tenantId}, #{orderId}, #{orderLineId}, #{productId}, #{supplierId},
        #{rating}, #{content})
      """)
  void insertReview(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("orderId") String orderId,
      @Param("orderLineId") String orderLineId,
      @Param("productId") String productId,
      @Param("supplierId") String supplierId,
      @Param("rating") int rating,
      @Param("content") String content);

  @Select("""
      select id, tenant_id, order_id, order_line_id, product_id, supplier_id, rating,
             content, created_at
      from mall_reviews where tenant_id = #{tenantId}
      order by created_at desc
      """)
  List<MallReview> listReviewsByTenant(@Param("tenantId") String tenantId);

  /** 商品评价:私域商品按租户隔离,公开专区商品的评价对所有可见方公开。 */
  @Select("""
      select r.id, null::text as tenant_id, null::text as order_id, null::text as order_line_id, r.product_id, r.supplier_id,
             r.rating, r.content, r.created_at
      from mall_reviews r
      join mall_products p on p.id = r.product_id
      where r.product_id = #{productId} and p.status = '在架'
        and ((p.tenant_id = #{tenantId} and r.tenant_id = #{tenantId}) or p.scope = 'public')
      order by r.created_at desc
      limit 20
      """)
  List<MallReview> listReviewsForProduct(
      @Param("tenantId") String tenantId, @Param("productId") String productId);

  @Select("""
      select count(1) from mall_reviews
      where tenant_id = #{tenantId} and order_line_id = #{orderLineId}
      """)
  int countReviewForLine(
      @Param("tenantId") String tenantId, @Param("orderLineId") String orderLineId);
}
