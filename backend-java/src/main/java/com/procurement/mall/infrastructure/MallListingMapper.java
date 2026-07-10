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
             l.unit, l.price, l.status, l.created_at, l.updated_at
      from mall_listings l
      left join enterprises e on e.id = l.supplier_id
      left join materials m on m.id = l.material_id and m.tenant_id = l.tenant_id
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
}
