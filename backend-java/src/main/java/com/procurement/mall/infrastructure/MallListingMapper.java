package com.procurement.mall.infrastructure;

import com.procurement.mall.domain.MallListing;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface MallListingMapper {

  String LISTING_SELECT =
      """
      select l.id, l.tenant_id, l.supplier_id,
             coalesce(e.name, l.supplier_id) as supplier_name,
             l.material_id,
             coalesce(m.name, l.material_id) as material_name,
             coalesce(m.code, '') as material_code,
             coalesce(m.category, '') as category,
             l.unit, l.price, l.status, l.created_at, l.updated_at,
             coalesce(t.name, l.tenant_id) as tenant_name
      from mall_listings l
      left join enterprises e on e.id = l.supplier_id
      left join materials m on m.id = l.material_id and m.tenant_id = l.tenant_id
      left join tenants t on t.id = l.tenant_id
      """;

  @Select("""
      <script>
      """ + LISTING_SELECT + """
      where l.tenant_id = #{tenantId}
        <if test="status != null and status != ''">
        and l.status = #{status}
        </if>
        <if test="keyword != null and keyword != ''">
        and (m.name ilike concat('%', #{keyword}, '%')
          or m.code ilike concat('%', #{keyword}, '%')
          or m.category ilike concat('%', #{keyword}, '%')
          or e.name ilike concat('%', #{keyword}, '%'))
        </if>
      order by l.created_at desc
      </script>
      """)
  List<MallListing> listByTenant(
      @Param("tenantId") String tenantId,
      @Param("status") String status,
      @Param("keyword") String keyword);

  @Select(LISTING_SELECT + " where l.tenant_id = #{tenantId} and l.id = #{id}")
  MallListing findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("""
      select count(1) from buyer_supplier_relations
      where tenant_id = #{tenantId} and supplier_id = #{supplierId} and status = '已准入'
      """)
  int countAdmittedSupplier(@Param("tenantId") String tenantId, @Param("supplierId") String supplierId);

  @Insert("""
      insert into mall_listings (id, tenant_id, supplier_id, material_id, price, unit, status)
      values (#{id}, #{tenantId}, #{supplierId}, #{materialId}, #{price}, #{unit}, #{status})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("supplierId") String supplierId,
      @Param("materialId") String materialId,
      @Param("price") BigDecimal price,
      @Param("unit") String unit,
      @Param("status") String status);

  @Update("""
      update mall_listings
      set status = #{status}, updated_at = now()
      where tenant_id = #{tenantId} and id = #{id}
      """)
  int updateStatus(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("status") String status);

  @Select(LISTING_SELECT + " where l.supplier_id = #{supplierId} order by l.created_at desc")
  List<MallListing> listBySupplier(@Param("supplierId") String supplierId);

  @Select(LISTING_SELECT + " where l.supplier_id = #{supplierId} and l.id = #{id}")
  MallListing findBySupplierAndId(@Param("supplierId") String supplierId, @Param("id") String id);

  @Update("""
      update mall_listings
      set price = #{price}, updated_at = now()
      where supplier_id = #{supplierId} and id = #{id}
      """)
  int updatePriceBySupplier(
      @Param("supplierId") String supplierId,
      @Param("id") String id,
      @Param("price") BigDecimal price);

  @Update("""
      update mall_listings
      set status = #{status}, updated_at = now()
      where supplier_id = #{supplierId} and id = #{id}
      """)
  int updateStatusBySupplier(
      @Param("supplierId") String supplierId,
      @Param("id") String id,
      @Param("status") String status);

  // 供应商可上架的物料:其被准入的各租户的物料目录(供发布协议价商品选择)。
  @Select("""
      select r.tenant_id as tenant_id,
             coalesce(t.name, r.tenant_id) as tenant_name,
             m.id as material_id, m.name as name, m.code as code,
             m.category as category, m.unit as unit, m.reference_price as reference_price
      from buyer_supplier_relations r
      join materials m on m.tenant_id = r.tenant_id
      left join tenants t on t.id = r.tenant_id
      where r.supplier_id = #{supplierId} and r.status = '已准入'
      order by r.tenant_id, m.name
      """)
  List<com.procurement.mall.domain.SupplierMallMaterial> listMaterialsForSupplier(
      @Param("supplierId") String supplierId);

  @Select("""
      select count(1) from buyer_supplier_relations
      where tenant_id = #{tenantId} and supplier_id = #{supplierId} and status = '已准入'
      """)
  int countAdmittedRelation(@Param("tenantId") String tenantId, @Param("supplierId") String supplierId);
}
