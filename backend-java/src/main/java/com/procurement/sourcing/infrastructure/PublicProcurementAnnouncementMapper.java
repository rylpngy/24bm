package com.procurement.sourcing.infrastructure;

import com.procurement.sourcing.api.PublicProcurementAnnouncementResponse;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

// 门户公开采购公告:跨租户只读,仅暴露公开安全字段(须在 TenantIsolationArchitectureTests 白名单)。
@Mapper
public interface PublicProcurementAnnouncementMapper {

  String COLUMNS = """
      a.id, a.rfq_id, a.type, a.title, a.summary, a.method, a.deadline_at,
      a.evaluation_method, a.quote_requirement, a.delivery_requirement,
      a.awarded_supplier_name, a.award_amount, a.close_reason, a.published_at,
      t.name as buyer_name
      """;

  @Select("""
      select
      """ + COLUMNS + """
      from rfq_announcements a
      join tenants t on t.id = a.tenant_id
      order by a.published_at desc
      limit 200
      """)
  List<PublicProcurementAnnouncementResponse> listPublicAnnouncements();

  @Select("""
      select
      """ + COLUMNS + """
      from rfq_announcements a
      join tenants t on t.id = a.tenant_id
      where a.id = #{id}
      """)
  PublicProcurementAnnouncementResponse findPublicAnnouncementById(@Param("id") String id);
}
