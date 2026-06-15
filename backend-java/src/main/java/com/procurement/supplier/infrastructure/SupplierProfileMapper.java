package com.procurement.supplier.infrastructure;

import com.procurement.supplier.domain.SupplierProfile;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface SupplierProfileMapper {

  @Select("""
      select id, name, type, industry, verified
      from enterprises
      where id = #{supplierId} and type = 'supplier'
      """)
  SupplierProfile findBySupplierId(@Param("supplierId") String supplierId);

  @Select("""
      select t.name
      from buyer_supplier_relations r
      join tenants t on t.id = r.tenant_id
      where r.supplier_id = #{supplierId}
        and r.status = '已准入'
      order by t.name
      """)
  List<String> listConnectedBuyerNames(@Param("supplierId") String supplierId);
}
