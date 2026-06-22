package com.procurement.contract.infrastructure;

import com.procurement.contract.domain.ContractFulfillmentEvent;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ContractFulfillmentEventMapper {

  @Select("""
      select id, tenant_id, contract_id, action_type, target_id, summary, source_label, created_by, created_at
      from contract_fulfillment_events
      where tenant_id = #{tenantId}
        and contract_id = #{contractId}
      order by created_at desc
      """)
  List<ContractFulfillmentEvent> listByTenantAndContract(
      @Param("tenantId") String tenantId,
      @Param("contractId") String contractId);

  @Select("""
      select id, tenant_id, contract_id, action_type, target_id, summary, source_label, created_by, created_at
      from contract_fulfillment_events
      where tenant_id = #{tenantId}
        and id = #{eventId}
      """)
  ContractFulfillmentEvent findByTenantAndId(
      @Param("tenantId") String tenantId,
      @Param("eventId") String eventId);

  @Insert("""
      insert into contract_fulfillment_events (
        id, tenant_id, contract_id, action_type, target_id, summary, source_label, created_by
      )
      values (
        #{id}, #{tenantId}, #{contractId}, #{actionType}, #{targetId}, #{summary}, #{sourceLabel}, #{createdBy}
      )
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("contractId") String contractId,
      @Param("actionType") String actionType,
      @Param("targetId") String targetId,
      @Param("summary") String summary,
      @Param("sourceLabel") String sourceLabel,
      @Param("createdBy") String createdBy);
}
