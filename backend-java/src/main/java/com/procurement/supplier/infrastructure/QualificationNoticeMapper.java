package com.procurement.supplier.infrastructure;

import java.time.LocalDate;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface QualificationNoticeMapper {
  record ReviewNotice(long id, String tenantId, String tenantName, String supplierId, String supplierName,
      String qualificationType, String status, String comment) {}
  record ExpiryNotice(String id, String tenantId, String supplierId, String supplierName,
      String qualificationType, LocalDate expiresAt) {}

  @Select("""
      select v.id,r.tenant_id,t.name as tenant_name,r.supplier_id,e.name as supplier_name,q.qualification_type,v.status,v.comment
      from supplier_qualification_reviews v join buyer_supplier_relations r on r.id=v.relation_id
      join tenants t on t.id=r.tenant_id
      join enterprises e on e.id=r.supplier_id join supplier_qualifications q on q.id=v.qualification_id
      where r.supplier_id=#{supplierId} and v.qualification_id=#{qualificationId} and v.status='pending'
      """)
  List<ReviewNotice> pending(String supplierId, String qualificationId);

  @Select("""
      select v.id,r.tenant_id,t.name as tenant_name,r.supplier_id,e.name as supplier_name,q.qualification_type,v.status,v.comment
      from supplier_qualification_reviews v join buyer_supplier_relations r on r.id=v.relation_id
      join tenants t on t.id=r.tenant_id
      join enterprises e on e.id=r.supplier_id join supplier_qualifications q on q.id=v.qualification_id
      where v.id=#{id} and r.tenant_id=#{tenantId} and v.status in ('approved','rejected')
      """)
  ReviewNotice result(String tenantId, long id);

  @Select("""
      select q.id,r.tenant_id,r.supplier_id,e.name as supplier_name,q.qualification_type,q.expires_at
      from supplier_qualifications q join buyer_supplier_relations r on r.supplier_id=q.supplier_id
      join enterprises e on e.id=q.supplier_id
      where q.status='active' and q.replaced_by is null and q.expires_at <= #{until}
        and r.status not in ('已退出','黑名单')
      order by q.id,r.tenant_id
      """)
  List<ExpiryNotice> expiring(LocalDate until);

  @Select("""
      select id from users where tenant_id=#{tenantId} and supplier_id is null and status='active'
      """)
  List<String> buyerUsers(String tenantId);

  @Select("""
      select id from users where supplier_id=#{supplierId} and tenant_id is null and status='active'
      """)
  List<String> supplierUsers(String supplierId);
}
