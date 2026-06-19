package com.procurement.platform.infrastructure;

import com.procurement.platform.domain.EnterpriseReview;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface PlatformEnterpriseMapper {

  @Select("""
      select e.id, e.name, e.type, e.verified,
             coalesce(s.verified_status, case when e.verified then 'approved' else 'pending' end) as review_status
      from enterprises e
      left join supplier_enterprises s on s.enterprise_id = e.id
      where e.verified = false
         or (e.type = 'supplier' and coalesce(s.verified_status, 'pending') = 'pending')
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
             coalesce(s.verified_status, case when e.verified then 'approved' else 'pending' end) as review_status
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
}
