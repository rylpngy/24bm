package com.procurement.supplier.infrastructure;
import org.apache.ibatis.annotations.*;
@Mapper
public interface SupplierImportMapper {
  @Select("select exists(select 1 from enterprises where id=#{id} and type='supplier' and verified=true)")
  boolean available(String id);
  @Select("select exists(select 1 from buyer_supplier_relations where tenant_id=#{tenant} and supplier_id=#{supplier})")
  boolean linked(String tenant,String supplier);
}
