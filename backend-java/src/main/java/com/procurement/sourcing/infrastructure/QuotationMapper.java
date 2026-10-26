package com.procurement.sourcing.infrastructure;

import java.time.OffsetDateTime;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface QuotationMapper {
  @Select("select name from enterprises where id=#{id}")
  String supplierName(@Param("id")String id);
  record Policy(String tenantId,String rfqId,boolean fullQuoteRequired,boolean autoExtend,int extensionHours,int maxAutoExtensions) {}
  record Version(String id,String tenantId,String quoteId,String rfqId,String supplierId,int versionNo,int round,
      String source,String actorId,String snapshotJson,OffsetDateTime createdAt) {}
  record FileRow(String id,String tenantId,String rfqId,String supplierId,String fileName,String storageKey,long contentSize,
      String sha256,String uploadedBy,OffsetDateTime createdAt) {}
  record Extension(String id,String tenantId,String rfqId,int round,OffsetDateTime oldDeadline,OffsetDateTime newDeadline,
      String mode,int validQuoteCount,String reason,String actorId,OffsetDateTime createdAt) {}

  @Select("select * from rfq_quotation_policies where tenant_id=#{tenant} and rfq_id=#{rfq}")
  Policy policy(@Param("tenant")String tenant,@Param("rfq")String rfq);
  @Insert("""
      insert into rfq_quotation_policies values(#{tenantId},#{rfqId},#{fullQuoteRequired},#{autoExtend},#{extensionHours},#{maxAutoExtensions})
      on conflict(tenant_id,rfq_id) do update set full_quote_required=excluded.full_quote_required,
      auto_extend=excluded.auto_extend,extension_hours=excluded.extension_hours,max_auto_extensions=excluded.max_auto_extensions
      """)
  void savePolicy(Policy policy);
  @Select("""
      select id,tenant_id,quote_id,rfq_id,supplier_id,version_no,round,source,actor_id,snapshot_json::text as snapshot_json,created_at
      from quote_versions where tenant_id=#{tenant} and rfq_id=#{rfq} order by created_at,quote_id,version_no
      """)
  List<Version> versions(@Param("tenant")String tenant,@Param("rfq")String rfq);
  @Select("""
      select id,tenant_id,quote_id,rfq_id,supplier_id,version_no,round,source,actor_id,snapshot_json::text as snapshot_json,created_at
      from quote_versions where tenant_id=#{tenant} and quote_id=#{quote} order by version_no desc limit 1
      """)
  Version latest(@Param("tenant")String tenant,@Param("quote")String quote);
  @Insert("""
      insert into quote_versions(id,tenant_id,quote_id,rfq_id,supplier_id,version_no,round,source,actor_id,snapshot_json,created_at)
      values(#{id},#{tenantId},#{quoteId},#{rfqId},#{supplierId},#{versionNo},#{round},#{source},#{actorId,jdbcType=VARCHAR},#{snapshotJson}::jsonb,#{createdAt})
      """)
  void insertVersion(Version version);
  @Insert("""
      insert into quote_submission_files(id,tenant_id,rfq_id,supplier_id,file_name,storage_key,content_size,sha256,uploaded_by)
      values(#{id},#{tenantId},#{rfqId},#{supplierId},#{fileName},#{storageKey},#{contentSize},#{sha256},#{uploadedBy})
      """)
  void insertFile(FileRow file);
  @Select("select * from quote_submission_files where id=#{id}")
  FileRow file(@Param("id")String id);
  @Select("select * from quote_submission_files where tenant_id=#{tenant} and rfq_id=#{rfq} and supplier_id=#{supplier} order by created_at desc")
  List<FileRow> files(@Param("tenant")String tenant,@Param("rfq")String rfq,@Param("supplier")String supplier);
  @Select("select * from rfq_deadline_extensions where tenant_id=#{tenant} and rfq_id=#{rfq} order by created_at")
  List<Extension> extensions(@Param("tenant")String tenant,@Param("rfq")String rfq);
  @Insert("""
      insert into rfq_deadline_extensions(id,tenant_id,rfq_id,round,old_deadline,new_deadline,mode,valid_quote_count,reason,actor_id)
      values(#{id},#{tenantId},#{rfqId},#{round},#{oldDeadline},#{newDeadline},#{mode},#{validQuoteCount},#{reason},#{actorId,jdbcType=VARCHAR})
      """)
  void insertExtension(Extension extension);
  @Select("""
      select p.* from rfq_quotation_policies p join rfqs r on r.tenant_id=p.tenant_id and r.id=p.rfq_id
      where p.auto_extend=true and r.status='报价中' and r.deadline_at<=now() order by r.deadline_at
      """)
  List<Policy> expiredPolicies();
}
