package com.procurement.mall.infrastructure;

import com.procurement.mall.domain.MallCategory;
import com.procurement.mall.domain.MallProduct;
import com.procurement.mall.domain.MallProductMedia;
import com.procurement.mall.domain.MallSku;
import com.procurement.mall.domain.MallTierPrice;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/**
 * 商城商品目录(M-1)。
 *
 * <p>子表(SKU / 阶梯价 / 图集)一律**在 SQL 里回连 mall_products 校验归属**,
 * 而不是只靠应用层先查一次:即便调用方漏了归属判断,越权的 id 也拿不到数据、改不动行。
 * 公开专区的跨租户只读查询在 {@link PublicMallMapper},不混在这里。
 */
@Mapper
public interface MallCatalogMapper {

  String PRODUCT_COLUMNS = """
      p.id, p.scope, p.tenant_id, p.supplier_id, e.name as supplier_name,
      p.category_id, c.name as category_name, p.name, p.brand, p.description_html,
      p.main_image_key, p.status, p.created_at, p.updated_at
      """;

  String PRODUCT_FROM = """
      from mall_products p
      join enterprises e on e.id = p.supplier_id
      left join mall_categories c on c.id = p.category_id
      """;

  /** 采购方可见:本租户私域商品 ∪ 公开专区商品。 */
  @Select("""
      <script>
      select
      """ + PRODUCT_COLUMNS + PRODUCT_FROM + """
      where (p.tenant_id = #{tenantId} or p.scope = 'public')
        <if test="onShelfOnly">and p.status = '在架'</if>
        <if test="categoryId != null">and p.category_id = #{categoryId}</if>
        <if test="keyword != null">
          and (p.name ilike '%' || #{keyword} || '%' or p.brand ilike '%' || #{keyword} || '%'
               or e.name ilike '%' || #{keyword} || '%')
        </if>
      order by p.updated_at desc
      </script>
      """)
  List<MallProduct> listForTenant(
      @Param("tenantId") String tenantId,
      @Param("onShelfOnly") boolean onShelfOnly,
      @Param("categoryId") String categoryId,
      @Param("keyword") String keyword);

  @Select("select " + PRODUCT_COLUMNS + PRODUCT_FROM
      + " where p.supplier_id = #{supplierId} order by p.updated_at desc")
  List<MallProduct> listBySupplier(@Param("supplierId") String supplierId);

  @Select("select " + PRODUCT_COLUMNS + PRODUCT_FROM
      + " where p.id = #{id} and (p.tenant_id = #{tenantId} or p.scope = 'public')")
  MallProduct findProductForTenant(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("select " + PRODUCT_COLUMNS + PRODUCT_FROM
      + " where p.id = #{id} and p.supplier_id = #{supplierId}")
  MallProduct findProductForSupplier(
      @Param("supplierId") String supplierId, @Param("id") String id);

  @Insert("""
      insert into mall_products (
        id, scope, tenant_id, supplier_id, category_id, name, brand, description_html,
        main_image_key, status)
      values (
        #{id}, #{scope}, #{tenantId}, #{supplierId}, #{categoryId}, #{name}, #{brand},
        #{descriptionHtml}, #{mainImageKey}, #{status})
      """)
  void insertProduct(
      @Param("id") String id,
      @Param("scope") String scope,
      @Param("tenantId") String tenantId,
      @Param("supplierId") String supplierId,
      @Param("categoryId") String categoryId,
      @Param("name") String name,
      @Param("brand") String brand,
      @Param("descriptionHtml") String descriptionHtml,
      @Param("mainImageKey") String mainImageKey,
      @Param("status") String status);

  @Update("""
      update mall_products set name = #{name}, brand = #{brand},
        description_html = #{descriptionHtml}, category_id = #{categoryId},
        main_image_key = #{mainImageKey}, updated_at = now()
      where id = #{id} and supplier_id = #{supplierId}
      """)
  int updateProduct(
      @Param("id") String id,
      @Param("supplierId") String supplierId,
      @Param("name") String name,
      @Param("brand") String brand,
      @Param("descriptionHtml") String descriptionHtml,
      @Param("categoryId") String categoryId,
      @Param("mainImageKey") String mainImageKey);

  @Update("""
      update mall_products set status = #{status}, updated_at = now()
      where id = #{id} and supplier_id = #{supplierId}
      """)
  int updateProductStatusBySupplier(
      @Param("id") String id, @Param("supplierId") String supplierId, @Param("status") String status);

  /** 采购方对自家私域商品的上下架(公开专区商品由供应商自管,故限定 tenant_id)。 */
  @Update("""
      update mall_products set status = #{status}, updated_at = now()
      where id = #{id} and tenant_id = #{tenantId}
      """)
  int updateProductStatusByTenant(
      @Param("id") String id, @Param("tenantId") String tenantId, @Param("status") String status);

  /** 采购方审核:落状态、意见与审核时间。 */
  @Update("""
      update mall_products set status = #{status}, review_comment = #{comment},
        reviewed_at = now(), updated_at = now()
      where id = #{id} and tenant_id = #{tenantId} and status = '待审核'
      """)
  int reviewProductByTenant(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("status") String status,
      @Param("comment") String comment);

  String SKU_COLUMNS = """
      s.id, s.product_id, s.sku_code, s.spec::text as spec, s.material_id, s.unit, s.price,
      s.min_order_qty, s.step_qty, s.stock_qty, s.lead_time_days, s.status, s.created_at, s.updated_at
      """;

  @Select("""
      select
      """ + SKU_COLUMNS + """
      from mall_skus s
      join mall_products p on p.id = s.product_id
      where s.product_id = #{productId} and (p.tenant_id = #{tenantId} or p.scope = 'public')
      order by s.created_at
      """)
  List<MallSku> listSkusForTenant(
      @Param("tenantId") String tenantId, @Param("productId") String productId);

  @Select("""
      select
      """ + SKU_COLUMNS + """
      from mall_skus s
      join mall_products p on p.id = s.product_id
      where s.product_id = #{productId} and p.supplier_id = #{supplierId}
      order by s.created_at
      """)
  List<MallSku> listSkusForSupplier(
      @Param("supplierId") String supplierId, @Param("productId") String productId);

  @Select("""
      select
      """ + SKU_COLUMNS + """
      from mall_skus s
      join mall_products p on p.id = s.product_id
      where s.id = #{id} and (p.tenant_id = #{tenantId} or p.scope = 'public')
      """)
  MallSku findSkuForTenant(@Param("tenantId") String tenantId, @Param("id") String id);

  @Insert("""
      insert into mall_skus (
        id, product_id, sku_code, spec, material_id, unit, price, min_order_qty, step_qty,
        stock_qty, lead_time_days, status)
      select #{id}, #{productId}, #{skuCode}, #{spec}::jsonb, #{materialId}, #{unit}, #{price},
        #{minOrderQty}, #{stepQty}, #{stockQty}, #{leadTimeDays}, '在架'
      from mall_products p where p.id = #{productId} and p.supplier_id = #{supplierId}
      """)
  int insertSkuForSupplier(
      @Param("id") String id,
      @Param("productId") String productId,
      @Param("supplierId") String supplierId,
      @Param("skuCode") String skuCode,
      @Param("spec") String spec,
      @Param("materialId") String materialId,
      @Param("unit") String unit,
      @Param("price") BigDecimal price,
      @Param("minOrderQty") BigDecimal minOrderQty,
      @Param("stepQty") BigDecimal stepQty,
      @Param("stockQty") BigDecimal stockQty,
      @Param("leadTimeDays") int leadTimeDays);

  @Update("""
      update mall_skus s set price = #{price}, min_order_qty = #{minOrderQty},
        step_qty = #{stepQty}, stock_qty = #{stockQty}, lead_time_days = #{leadTimeDays},
        updated_at = now()
      from mall_products p
      where p.id = s.product_id and s.id = #{id} and p.supplier_id = #{supplierId}
      """)
  int updateSkuForSupplier(
      @Param("id") String id,
      @Param("supplierId") String supplierId,
      @Param("price") BigDecimal price,
      @Param("minOrderQty") BigDecimal minOrderQty,
      @Param("stepQty") BigDecimal stepQty,
      @Param("stockQty") BigDecimal stockQty,
      @Param("leadTimeDays") int leadTimeDays);

  @Update("""
      update mall_skus s set status = #{status}, updated_at = now()
      from mall_products p
      where p.id = s.product_id and s.id = #{id} and p.supplier_id = #{supplierId}
      """)
  int updateSkuStatusForSupplier(
      @Param("id") String id, @Param("supplierId") String supplierId, @Param("status") String status);

  /** 扣减库存:库存不足时不生效(返回 0),由调用方转成「库存不足」业务错误,防并发超卖。 */
  @Update("""
      update mall_skus s set stock_qty = s.stock_qty - #{quantity}, updated_at = now()
      from mall_products p
      where p.id = s.product_id and s.id = #{id}
        and (p.tenant_id = #{tenantId} or p.scope = 'public')
        and s.stock_qty is not null and s.stock_qty >= #{quantity}
      """)
  int deductStock(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("quantity") BigDecimal quantity);

  @Select("""
      select t.sku_id, t.min_qty, t.price
      from mall_sku_tier_prices t
      join mall_skus s on s.id = t.sku_id
      join mall_products p on p.id = s.product_id
      where t.sku_id = #{skuId} and (p.tenant_id = #{tenantId} or p.scope = 'public')
      order by t.min_qty
      """)
  List<MallTierPrice> listTiersForTenant(
      @Param("tenantId") String tenantId, @Param("skuId") String skuId);

  @Select("""
      select t.sku_id, t.min_qty, t.price
      from mall_sku_tier_prices t
      join mall_skus s on s.id = t.sku_id
      join mall_products p on p.id = s.product_id
      where t.sku_id = #{skuId} and p.supplier_id = #{supplierId}
      order by t.min_qty
      """)
  List<MallTierPrice> listTiersForSupplier(
      @Param("supplierId") String supplierId, @Param("skuId") String skuId);

  @Insert("""
      insert into mall_sku_tier_prices (sku_id, min_qty, price)
      select #{skuId}, #{minQty}, #{price}
      from mall_skus s join mall_products p on p.id = s.product_id
      where s.id = #{skuId} and p.supplier_id = #{supplierId}
      on conflict (sku_id, min_qty) do update set price = excluded.price
      """)
  int upsertTierForSupplier(
      @Param("supplierId") String supplierId,
      @Param("skuId") String skuId,
      @Param("minQty") BigDecimal minQty,
      @Param("price") BigDecimal price);

  @Delete("""
      delete from mall_sku_tier_prices t
      using mall_skus s join mall_products p on p.id = s.product_id
      where t.sku_id = s.id and s.id = #{skuId} and p.supplier_id = #{supplierId}
      """)
  int clearTiersForSupplier(@Param("supplierId") String supplierId, @Param("skuId") String skuId);

  @Select("""
      select m.id, m.product_id, m.storage_key, m.sort_order
      from mall_product_media m
      join mall_products p on p.id = m.product_id
      where m.product_id = #{productId} and (p.tenant_id = #{tenantId} or p.scope = 'public')
      order by m.sort_order
      """)
  List<MallProductMedia> listMediaForTenant(
      @Param("tenantId") String tenantId, @Param("productId") String productId);

  @Insert("""
      insert into mall_product_media (id, product_id, storage_key, sort_order)
      select #{id}, #{productId}, #{storageKey}, #{sortOrder}
      from mall_products p where p.id = #{productId} and p.supplier_id = #{supplierId}
      """)
  int insertMediaForSupplier(
      @Param("id") String id,
      @Param("productId") String productId,
      @Param("supplierId") String supplierId,
      @Param("storageKey") String storageKey,
      @Param("sortOrder") int sortOrder);

  /** 分类:平台级(tenant_id 为空)对所有租户可见,叠加本租户自建分类。 */
  @Select("""
      select id, tenant_id, parent_id, name, sort_order, created_at
      from mall_categories
      where tenant_id = #{tenantId} or tenant_id is null
      order by sort_order, name
      """)
  List<MallCategory> listCategories(@Param("tenantId") String tenantId);

  @Insert("""
      insert into mall_categories (id, tenant_id, parent_id, name, sort_order)
      values (#{id}, #{tenantId}, #{parentId}, #{name}, #{sortOrder})
      """)
  void insertCategory(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("parentId") String parentId,
      @Param("name") String name,
      @Param("sortOrder") int sortOrder);

  /** 建商品时取物料名称/编码/单位(物料本身按租户隔离)。 */
  @Select("""
      select id, code, name, unit from materials
      where tenant_id = #{tenantId} and id = #{materialId}
      """)
  @org.apache.ibatis.annotations.ConstructorArgs({
      @org.apache.ibatis.annotations.Arg(column = "id", javaType = String.class),
      @org.apache.ibatis.annotations.Arg(column = "code", javaType = String.class),
      @org.apache.ibatis.annotations.Arg(column = "name", javaType = String.class),
      @org.apache.ibatis.annotations.Arg(column = "unit", javaType = String.class)
  })
  MaterialBrief findMaterialBrief(
      @Param("tenantId") String tenantId, @Param("materialId") String materialId);

  record MaterialBrief(String id, String code, String name, String unit) {}
}
