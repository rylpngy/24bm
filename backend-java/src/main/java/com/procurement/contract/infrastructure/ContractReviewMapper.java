package com.procurement.contract.infrastructure;

import java.time.OffsetDateTime;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface ContractReviewMapper {
  @Select("select name || coalesce('（' || employee_no || '）','') from users where tenant_id=#{tenant} and id=#{id}")
  String actorName(@Param("tenant")String tenant,@Param("id")String id);
  record RulesRow(String id,String tenantId,String name,String draftJson,int revision,String createdBy,OffsetDateTime createdAt) {}
  record RulesVersionRow(String id,String tenantId,String setId,int version,String name,String rulesJson,String createdBy,OffsetDateTime createdAt) {}
  record DocumentRow(String id,String tenantId,String contractId,String fileName,String storageKey,String originalSha256,
      int currentVersion,String limitationsJson,String createdBy,OffsetDateTime createdAt) {}
  record DocumentVersionRow(String id,String tenantId,String documentId,int version,String segmentsJson,String textSha256,String createdBy,OffsetDateTime createdAt) {}
  record RunRow(String id,String tenantId,String documentId,int documentVersion,String rulesVersionId,String perspective,
      String mode,String model,String limitation,String findingsJson,String createdBy,OffsetDateTime createdAt) {}
  record DecisionRow(String id,String tenantId,String documentId,String runId,String findingId,String action,int oldVersion,int newVersion,
      String locator,String beforeText,String afterText,String comment,String actorId,OffsetDateTime createdAt) {}

  @Select("select * from contract_review_rule_sets where tenant_id=#{tenant} order by created_at desc")
  List<RulesRow> ruleSets(String tenant);
  @Select("select * from contract_review_rule_sets where tenant_id=#{tenant} and id=#{id} for update")
  RulesRow lockRules(@Param("tenant")String tenant,@Param("id")String id);
  @Insert("insert into contract_review_rule_sets values(#{id},#{tenantId},#{name},#{draftJson}::jsonb,#{revision},#{createdBy},#{createdAt})")
  void insertRules(RulesRow row);
  @Update("update contract_review_rule_sets set name=#{name},draft_json=#{draftJson}::jsonb,revision=revision+1 where tenant_id=#{tenantId} and id=#{id}")
  void updateRules(RulesRow row);
  @Select("select * from contract_review_rule_versions where tenant_id=#{tenant} order by created_at desc")
  List<RulesVersionRow> ruleVersions(String tenant);
  @Select("select * from contract_review_rule_versions where tenant_id=#{tenant} and id=#{id}")
  RulesVersionRow ruleVersion(@Param("tenant")String tenant,@Param("id")String id);
  @Select("select coalesce(max(version),0)+1 from contract_review_rule_versions where tenant_id=#{tenant} and set_id=#{setId}")
  int nextRuleVersion(@Param("tenant")String tenant,@Param("setId")String setId);
  @Insert("insert into contract_review_rule_versions values(#{id},#{tenantId},#{setId},#{version},#{name},#{rulesJson}::jsonb,#{createdBy},#{createdAt})")
  void insertRuleVersion(RulesVersionRow row);

  String VISIBLE="""
      <if test='restricted'> and d.created_by in (select u.id from users u where
      <choose><when test='requester != null'>u.id=#{requester}</when><otherwise>u.department_id in
      <foreach collection='departments' item='dept' open='(' separator=',' close=')'>#{dept}</foreach></otherwise></choose>)</if>
      """;
  @Select("<script>select d.* from contract_review_documents d where d.tenant_id=#{tenant}"+VISIBLE+" order by d.created_at desc,d.id limit #{limit} offset #{offset}</script>")
  List<DocumentRow> documents(@Param("tenant")String tenant,@Param("restricted")boolean restricted,@Param("requester")String requester,
      @Param("departments")List<String> departments,@Param("limit")int limit,@Param("offset")int offset);
  @Select("<script>select count(*) from contract_review_documents d where d.tenant_id=#{tenant}"+VISIBLE+"</script>")
  long documentCount(@Param("tenant")String tenant,@Param("restricted")boolean restricted,@Param("requester")String requester,@Param("departments")List<String> departments);
  @Select("select * from contract_review_documents where tenant_id=#{tenant} and id=#{id}")
  DocumentRow document(@Param("tenant")String tenant,@Param("id")String id);
  @Select("select * from contract_review_documents where tenant_id=#{tenant} and id=#{id} for update")
  DocumentRow lockDocument(@Param("tenant")String tenant,@Param("id")String id);
  @Insert("insert into contract_review_documents values(#{id},#{tenantId},#{contractId,jdbcType=VARCHAR},#{fileName},#{storageKey},#{originalSha256},#{currentVersion},#{limitationsJson}::jsonb,#{createdBy},#{createdAt})")
  void insertDocument(DocumentRow row);
  @Update("update contract_review_documents set current_version=#{version} where tenant_id=#{tenant} and id=#{id}")
  void advanceDocument(@Param("tenant")String tenant,@Param("id")String id,@Param("version")int version);
  @Select("select * from contract_review_document_versions where tenant_id=#{tenant} and document_id=#{id} order by version desc")
  List<DocumentVersionRow> documentVersions(@Param("tenant")String tenant,@Param("id")String id);
  @Insert("insert into contract_review_document_versions values(#{id},#{tenantId},#{documentId},#{version},#{segmentsJson}::jsonb,#{textSha256},#{createdBy},#{createdAt})")
  void insertDocumentVersion(DocumentVersionRow row);
  @Select("select * from contract_review_runs where tenant_id=#{tenant} and document_id=#{id} order by created_at desc")
  List<RunRow> runs(@Param("tenant")String tenant,@Param("id")String id);
  @Select("select * from contract_review_runs where tenant_id=#{tenant} and id=#{id}")
  RunRow run(@Param("tenant")String tenant,@Param("id")String id);
  @Insert("insert into contract_review_runs values(#{id},#{tenantId},#{documentId},#{documentVersion},#{rulesVersionId},#{perspective},#{mode},#{model,jdbcType=VARCHAR},#{limitation,jdbcType=VARCHAR},#{findingsJson}::jsonb,#{createdBy},#{createdAt})")
  void insertRun(RunRow row);
  @Select("select * from contract_review_decisions where tenant_id=#{tenant} and document_id=#{id} order by created_at desc")
  List<DecisionRow> decisions(@Param("tenant")String tenant,@Param("id")String id);
  @Insert("insert into contract_review_decisions values(#{id},#{tenantId},#{documentId},#{runId},#{findingId},#{action},#{oldVersion},#{newVersion},#{locator,jdbcType=VARCHAR},#{beforeText},#{afterText},#{comment},#{actorId},#{createdAt})")
  void insertDecision(DecisionRow row);
}
