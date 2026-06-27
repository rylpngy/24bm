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
      id, tenant_id, supplier_id, supplier_name, contact, category, note,
      status, created_at, updated_at, responded_at
      """;

  @Select("select " + COLUMNS + " from supplier_invitations"
      + " where tenant_id = #{tenantId} order by created_at desc")
  List<SupplierInvitation> listByTenant(@Param("tenantId") String tenantId);

  @Select("select " + COLUMNS + " from supplier_invitations"
      + " where tenant_id = #{tenantId} and id = #{id}")
  SupplierInvitation findByTenantAndId(
      @Param("tenantId") String tenantId, @Param("id") String id);

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
