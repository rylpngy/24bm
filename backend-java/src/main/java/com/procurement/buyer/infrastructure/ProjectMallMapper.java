package com.procurement.buyer.infrastructure;

import com.procurement.buyer.api.ProjectMallContracts.Selection;
import org.apache.ibatis.annotations.*;

@Mapper
public interface ProjectMallMapper {
  String COLS =
      "project_id,package_id,rfq_id,order_id,request_key,request_hash,snapshot::text,reason,actor_id,created_at";

  @Select(
      "select "
          + COLS
          + " from procurement_project_mall_selections where tenant_id=#{t} and package_id=#{id}")
  Selection find(@Param("t") String tenant, @Param("id") String id);

  @Select(
      "select snapshot::text from procurement_project_mall_selections where tenant_id=#{t} and"
          + " rfq_id=#{id}")
  String snapshotForRfq(@Param("t") String tenant, @Param("id") String id);

  @Insert(
      "insert into"
          + " procurement_project_mall_selections(tenant_id,project_id,package_id,rfq_id,order_id,request_key,request_hash,snapshot,reason,actor_id)"
          + " values(#{t},#{s.projectId},#{s.packageId},#{s.rfqId},#{s.orderId},#{s.requestKey},#{s.requestHash},cast(#{s.snapshot}"
          + " as jsonb),#{s.reason},#{s.actorId})")
  void insert(@Param("t") String tenant, @Param("s") Selection selection);
}
