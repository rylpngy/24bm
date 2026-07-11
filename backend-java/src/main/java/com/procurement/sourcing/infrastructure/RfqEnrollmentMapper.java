package com.procurement.sourcing.infrastructure;

import com.procurement.sourcing.domain.RfqEnrollment;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface RfqEnrollmentMapper {

  @Insert("""
      insert into rfq_enrollments (id, tenant_id, rfq_id, company_name, contact_name, contact_phone, note)
      values (#{id}, #{tenantId}, #{rfqId}, #{companyName}, #{contactName}, #{contactPhone}, #{note})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("rfqId") String rfqId,
      @Param("companyName") String companyName,
      @Param("contactName") String contactName,
      @Param("contactPhone") String contactPhone,
      @Param("note") String note);

  @Select("""
      select count(*)
      from rfq_enrollments
      where tenant_id = #{tenantId} and rfq_id = #{rfqId}
        and company_name = #{companyName} and status = '待处理'
      """)
  int countPending(
      @Param("tenantId") String tenantId,
      @Param("rfqId") String rfqId,
      @Param("companyName") String companyName);

  @Select("""
      select id, tenant_id, rfq_id, company_name, contact_name, contact_phone, note,
             status, created_at, updated_at
      from rfq_enrollments
      where tenant_id = #{tenantId} and rfq_id = #{rfqId}
      order by created_at desc
      """)
  List<RfqEnrollment> listByRfq(@Param("tenantId") String tenantId, @Param("rfqId") String rfqId);

  @Select("""
      select id, tenant_id, rfq_id, company_name, contact_name, contact_phone, note,
             status, created_at, updated_at
      from rfq_enrollments
      where tenant_id = #{tenantId} and id = #{id}
      """)
  RfqEnrollment findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Update("""
      update rfq_enrollments
      set status = #{toStatus}, updated_at = now()
      where tenant_id = #{tenantId} and id = #{id} and status = '待处理'
      """)
  int updateStatus(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("toStatus") String toStatus);
}
