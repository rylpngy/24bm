package com.procurement.catalog.infrastructure;

import com.procurement.catalog.domain.Material;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface MaterialMapper {

  String COLUMNS =
      "id, tenant_id, code, name, category, unit, reference_price,"
          + " specification, brand, tax_rate, description";

  @Select("""
      <script>
      select id, tenant_id, code, name, category, unit, reference_price,
             specification, brand, tax_rate, description
      from materials
      where tenant_id = #{tenantId}
        <if test="category != null and category != ''">
        and category = #{category}
        </if>
        <if test="keyword != null and keyword != ''">
        and (
          code ilike concat('%', #{keyword}, '%')
          or name ilike concat('%', #{keyword}, '%')
          or specification ilike concat('%', #{keyword}, '%')
          or brand ilike concat('%', #{keyword}, '%')
        )
        </if>
      order by code asc
      </script>
      """)
  List<Material> listByTenant(
      @Param("tenantId") String tenantId,
      @Param("category") String category,
      @Param("keyword") String keyword);

  @Select("""
      select id, tenant_id, code, name, category, unit, reference_price,
             specification, brand, tax_rate, description
      from materials
      where tenant_id = #{tenantId} and id = #{id}
      """)
  Material findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Insert("""
      insert into materials (
        id, tenant_id, code, name, category, unit, reference_price,
        specification, brand, tax_rate, description
      ) values (
        #{id}, #{tenantId}, #{code}, #{name}, #{category}, #{unit}, #{referencePrice},
        #{specification}, #{brand}, #{taxRate}, #{description}
      )
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("code") String code,
      @Param("name") String name,
      @Param("category") String category,
      @Param("unit") String unit,
      @Param("referencePrice") BigDecimal referencePrice,
      @Param("specification") String specification,
      @Param("brand") String brand,
      @Param("taxRate") BigDecimal taxRate,
      @Param("description") String description);

  @Update("""
      update materials
      set code = #{code},
          name = #{name},
          category = #{category},
          unit = #{unit},
          reference_price = #{referencePrice},
          specification = #{specification},
          brand = #{brand},
          tax_rate = #{taxRate},
          description = #{description},
          updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{id}
      """)
  void update(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("code") String code,
      @Param("name") String name,
      @Param("category") String category,
      @Param("unit") String unit,
      @Param("referencePrice") BigDecimal referencePrice,
      @Param("specification") String specification,
      @Param("brand") String brand,
      @Param("taxRate") BigDecimal taxRate,
      @Param("description") String description);
}
