package com.procurement.numbering.infrastructure;

import com.procurement.numbering.domain.NumberingRule;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface NumberingRuleMapper {
  @Select("""
      select business_type, prefix, date_format, width, enabled from numbering_rules
      where tenant_id = #{tenantId} and business_type = #{businessType}
      """)
  NumberingRule find(@Param("tenantId") String tenantId, @Param("businessType") String businessType);

  @Insert("""
      insert into numbering_rules(tenant_id, business_type, prefix, date_format, width, enabled)
      values (#{tenantId}, #{rule.businessType}, #{rule.prefix}, #{rule.dateFormat}, #{rule.width}, #{rule.enabled})
      on conflict (tenant_id, business_type) do update set prefix = excluded.prefix,
        date_format = excluded.date_format, width = excluded.width, enabled = excluded.enabled, updated_at = now()
      """)
  int save(@Param("tenantId") String tenantId, @Param("rule") NumberingRule rule);

  // Global uniqueness is deliberate: demand.id is a global PK. This returns only a claim result,
  // never another tenant's record. Reservations survive rule edits, disabling and business deletion.
  @Insert("""
      insert into numbering_reservations(tenant_id, business_type, number)
      values (#{tenantId}, #{businessType}, #{number}) on conflict (business_type, number) do nothing
      """)
  int reserve(@Param("tenantId") String tenantId, @Param("businessType") String businessType,
      @Param("number") String number);
}
