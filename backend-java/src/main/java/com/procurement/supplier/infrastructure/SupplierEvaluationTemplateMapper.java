package com.procurement.supplier.infrastructure;

import com.procurement.supplier.api.SupplierEvaluationTemplateResponse;
import com.procurement.supplier.api.SupplierEvaluationTemplateRequests.Definition;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface SupplierEvaluationTemplateMapper {
  String SELECT = """
      select v.id,v.template_id,v.name,v.version,v.quality_weight,v.delivery_weight,
        v.price_weight,v.service_weight,t.enabled,v.created_at
      from supplier_evaluation_template_versions v
      join supplier_evaluation_templates t on t.id=v.template_id and t.tenant_id=v.tenant_id
      """;

  @Select(SELECT + " where t.tenant_id=#{tenantId} order by t.created_at,t.id,v.version desc")
  List<SupplierEvaluationTemplateResponse> list(String tenantId);

  @Insert("insert into supplier_evaluation_templates(id,tenant_id) values(#{id},#{tenantId})")
  void insertTemplate(@Param("id") String id, @Param("tenantId") String tenantId);

  @Select("select id from supplier_evaluation_templates where tenant_id=#{tenantId} and id=#{id} for update")
  @Options(flushCache = Options.FlushCachePolicy.TRUE)
  String lock(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select(SELECT + " where t.tenant_id=#{tenantId} and v.id=#{id}")
  SupplierEvaluationTemplateResponse find(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("select coalesce(max(version),0)+1 from supplier_evaluation_template_versions where tenant_id=#{tenantId} and template_id=#{id}")
  int nextVersion(@Param("tenantId") String tenantId, @Param("id") String id);

  @Insert("""
      insert into supplier_evaluation_template_versions(id,tenant_id,template_id,name,version,
        quality_weight,delivery_weight,price_weight,service_weight)
      values(#{id},#{tenantId},#{templateId},#{definition.name},#{version},#{definition.qualityWeight},
        #{definition.deliveryWeight},#{definition.priceWeight},#{definition.serviceWeight})
      """)
  void insertVersion(@Param("id") String id, @Param("tenantId") String tenantId,
      @Param("templateId") String templateId, @Param("version") int version,
      @Param("definition") Definition definition);

  @Update("update supplier_evaluation_templates set enabled=#{enabled} where tenant_id=#{tenantId} and id=#{id}")
  void enabled(@Param("tenantId") String tenantId, @Param("id") String id, @Param("enabled") boolean enabled);
}
