package com.procurement.platform.infrastructure;

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
             coalesce(s.risk_confirmed, false) as risk_confirmed
      from enterprises e
      left join supplier_enterprises s on s.enterprise_id = e.id
      where (e.type <> 'supplier' and e.verified = false)
         or (e.type = 'supplier'
             and coalesce(s.verified_status, 'pending') in ('pending', 'preliminary'))
      order by e.created_at desc
      """)
  List<EnterpriseReview> listPendingReviews();

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
             coalesce(s.risk_confirmed, false) as risk_confirmed
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
