package com.procurement.catalog.infrastructure;

import com.procurement.catalog.domain.Material;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface MaterialMapper {

  @Select("""
      select id, tenant_id, code, name, category, unit, reference_price
      from materials
      where tenant_id = #{tenantId}
      order by code asc
      """)
  @Results(id = "materialResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "reference_price", property = "referencePrice")
  })
  List<Material> listByTenant(@Param("tenantId") String tenantId);

  @Select("""
      select id, tenant_id, code, name, category, unit, reference_price
      from materials
      where tenant_id = #{tenantId} and id = #{id}
      """)
  @Results(id = "singleMaterialResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "reference_price", property = "referencePrice")
  })
  Material findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Insert("""
      insert into materials (id, tenant_id, code, name, category, unit, reference_price)
      values (#{id}, #{tenantId}, #{code}, #{name}, #{category}, #{unit}, #{referencePrice})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("code") String code,
      @Param("name") String name,
      @Param("category") String category,
      @Param("unit") String unit,
      @Param("referencePrice") BigDecimal referencePrice);

  @Update("""
      update materials
      set code = #{code},
          name = #{name},
          category = #{category},
          unit = #{unit},
          reference_price = #{referencePrice},
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
      @Param("referencePrice") BigDecimal referencePrice);
}
