package com.procurement.platform.infrastructure;

import com.procurement.platform.api.PublicSupplierResponse;
import com.procurement.platform.domain.EnterpriseReview;
import com.procurement.platform.domain.EnterpriseReviewEvent;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface PlatformEnterpriseMapper {

  @Select("""
      select e.id, e.name, e.type, e.verified,
             coalesce(s.verified_status, case when e.verified then 'approved' else 'pending' end) as review_status,
             s.review_comment,
             coalesce(s.profile_confirmed, false) as profile_confirmed,
             coalesce(s.risk_confirmed, false) as risk_confirmed,
             e.industry, s.credit_code, s.legal_person,
             s.contact_name, s.contact_phone, s.contact_email
      from enterprises e
      left join supplier_enterprises s on s.enterprise_id = e.id
      where (e.type <> 'supplier' and e.verified = false)
         or (e.type = 'supplier'
             and coalesce(s.verified_status, 'pending') in ('pending', 'preliminary'))
      order by e.created_at desc
      """)
  List<EnterpriseReview> listPendingReviews();

  // 门户入驻申请:未认证供应商企业 + 待初审明细(含联系人,供审核联系)。
  @Select("""
      select count(*) from enterprises where name = #{name}
      """)
  int countEnterpriseByName(@Param("name") String name);

  @Insert("""
      insert into enterprises (id, name, type, industry, verified)
      values (#{id}, #{name}, 'supplier', #{industry}, false)
      """)
  void insertSupplierRegistration(
      @Param("id") String id,
      @Param("name") String name,
      @Param("industry") String industry);

  @Insert("""
      insert into supplier_enterprises (
        enterprise_id, credit_code, legal_person, verified_status, profile_status,
        contact_name, contact_phone, contact_email, business_scope
      ) values (
        #{enterpriseId}, #{creditCode}, #{legalPerson}, 'pending', 'draft',
        #{contactName}, #{contactPhone}, #{contactEmail}, #{businessScope}
      )
      """)
  void insertSupplierRegistrationDetail(
      @Param("enterpriseId") String enterpriseId,
      @Param("creditCode") String creditCode,
      @Param("legalPerson") String legalPerson,
      @Param("contactName") String contactName,
      @Param("contactPhone") String contactPhone,
      @Param("contactEmail") String contactEmail,
      @Param("businessScope") String businessScope);

  // 公开门户名录:仅认证通过的供应商企业,仅公开安全字段。
  @Select("""
      select e.id, e.name, e.industry, e.verified,
             coalesce(s.verified_status, 'pending') as verified_status
      from enterprises e
      left join supplier_enterprises s on s.enterprise_id = e.id
      where e.type = 'supplier' and e.verified = true
      order by e.name asc
      """)
  List<PublicSupplierResponse> listPublicSuppliers();

  @Select("""
      select e.id, e.name, e.industry, e.verified,
             coalesce(s.verified_status, 'pending') as verified_status
      from enterprises e
      left join supplier_enterprises s on s.enterprise_id = e.id
      where e.id = #{enterpriseId} and e.type = 'supplier' and e.verified = true
      """)
  PublicSupplierResponse findPublicSupplierById(@Param("enterpriseId") String enterpriseId);

  @Select("""
      select count(1)
      from enterprises
      where type = 'supplier'
      """)
  int countPublicSuppliers();

  @Select("""
      select e.id, e.name, e.type, e.verified,
             coalesce(s.verified_status, case when e.verified then 'approved' else 'pending' end) as review_status,
             s.review_comment,
             coalesce(s.profile_confirmed, false) as profile_confirmed,
             coalesce(s.risk_confirmed, false) as risk_confirmed,
             e.industry, s.credit_code, s.legal_person,
             s.contact_name, s.contact_phone, s.contact_email
      from enterprises e
      left join supplier_enterprises s on s.enterprise_id = e.id
      where e.id = #{enterpriseId}
      """)
  EnterpriseReview findById(@Param("enterpriseId") String enterpriseId);

  @Update("""
      update enterprises
      set verified = #{verified},
          updated_at = now()
      where id = #{enterpriseId}
      """)
  int updateEnterpriseVerified(
      @Param("enterpriseId") String enterpriseId,
      @Param("verified") Boolean verified);

  @Update("""
      update supplier_enterprises
      set verified_status = #{reviewStatus}
      where enterprise_id = #{enterpriseId}
      """)
  int updateSupplierReviewStatus(
      @Param("enterpriseId") String enterpriseId,
      @Param("reviewStatus") String reviewStatus);

  // 多步审核状态机:当前阶段(supplier 用 verified_status,无 supplier 行时按 verified 推导)。
  @Select("""
      select coalesce(s.verified_status, case when e.verified then 'approved' else 'pending' end)
      from enterprises e
      left join supplier_enterprises s on s.enterprise_id = e.id
      where e.id = #{enterpriseId}
      """)
  String findReviewStatus(@Param("enterpriseId") String enterpriseId);

  @Insert("""
      insert into enterprise_review_events
        (id, enterprise_id, actor_id, action, from_status, to_status, comment)
      values
        (#{id}, #{enterpriseId}, #{actorId}, #{action}, #{fromStatus}, #{toStatus}, #{comment})
      """)
  void insertReviewEvent(
      @Param("id") String id,
      @Param("enterpriseId") String enterpriseId,
      @Param("actorId") String actorId,
      @Param("action") String action,
      @Param("fromStatus") String fromStatus,
      @Param("toStatus") String toStatus,
      @Param("comment") String comment);

  @Select("""
      select id, enterprise_id, actor_id, action, from_status, to_status, comment, created_at
      from enterprise_review_events
      where enterprise_id = #{enterpriseId}
      order by created_at desc
      """)
  List<EnterpriseReviewEvent> listReviewEvents(@Param("enterpriseId") String enterpriseId);

  @Update("""
      update supplier_enterprises
      set review_comment = #{reviewComment},
          profile_confirmed = #{profileConfirmed},
          risk_confirmed = #{riskConfirmed}
      where enterprise_id = #{enterpriseId}
      """)
  int updateSupplierReviewDetail(
      @Param("enterpriseId") String enterpriseId,
      @Param("reviewComment") String reviewComment,
      @Param("profileConfirmed") Boolean profileConfirmed,
      @Param("riskConfirmed") Boolean riskConfirmed);
}
