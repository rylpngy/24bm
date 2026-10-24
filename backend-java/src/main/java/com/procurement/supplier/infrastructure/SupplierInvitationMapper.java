package com.procurement.supplier.infrastructure;

import com.procurement.supplier.domain.SupplierInvitation;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface SupplierInvitationMapper {

  String COLUMNS =
      """
      i.id, i.tenant_id, i.supplier_id, i.supplier_name, i.contact, i.category, i.note,
      i.status, i.created_at, i.updated_at, i.responded_at, t.name as buyer_name
      """;

  String FROM = " from supplier_invitations i join tenants t on t.id = i.tenant_id ";

  @Select("select " + COLUMNS + FROM
      + " where i.tenant_id = #{tenantId} order by i.created_at desc, i.id")
  List<SupplierInvitation> listByTenant(@Param("tenantId") String tenantId);

  @Select("select " + COLUMNS + FROM
      + " where i.tenant_id = #{tenantId} and i.id = #{id}")
  SupplierInvitation findByTenantAndId(
      @Param("tenantId") String tenantId, @Param("id") String id);

  @Select("select " + COLUMNS + FROM + " where i.supplier_id = #{supplierId} order by i.created_at desc, i.id")
  List<SupplierInvitation> listBySupplier(@Param("supplierId") String supplierId);

  @Select("select " + COLUMNS + FROM + " where i.tenant_id = #{tenantId} and i.id = #{id} for update of i")
  @org.apache.ibatis.annotations.Options(flushCache = org.apache.ibatis.annotations.Options.FlushCachePolicy.TRUE)
  SupplierInvitation lockByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("select " + COLUMNS + FROM + " where i.supplier_id = #{supplierId} and i.id = #{id} for update of i")
  @org.apache.ibatis.annotations.Options(flushCache = org.apache.ibatis.annotations.Options.FlushCachePolicy.TRUE)
  SupplierInvitation lockBySupplierAndId(@Param("supplierId") String supplierId, @Param("id") String id);

  @Select("select name from enterprises where id = #{supplierId} and type = 'supplier'")
  String findSupplierName(@Param("supplierId") String supplierId);

  @Insert("""
      insert into supplier_invitations
        (id, tenant_id, supplier_id, supplier_name, contact, category, note, status)
      values
        (#{id}, #{tenantId}, #{supplierId,jdbcType=VARCHAR}, #{supplierName},
         #{contact,jdbcType=VARCHAR}, #{category,jdbcType=VARCHAR},
         #{note,jdbcType=VARCHAR}, #{status})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("supplierId") String supplierId,
      @Param("supplierName") String supplierName,
      @Param("contact") String contact,
      @Param("category") String category,
      @Param("note") String note,
      @Param("status") String status);

  @Update("""
      update supplier_invitations
      set status = #{status}, responded_at = now(), updated_at = now()
      where tenant_id = #{tenantId} and id = #{id} and status = '待回复'
      """)
  int respond(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("status") String status);
}
