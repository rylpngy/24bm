package com.procurement.ai.infrastructure;

import java.time.OffsetDateTime;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface AiPolicyMapper {
  record PolicyRow(String id, String policyKey, int version, String title, String content,
      String status, String sourceHash, String createdBy, OffsetDateTime createdAt) {}
  @Select("select 1 from (select pg_advisory_xact_lock(hashtextextended(#{key},0))) locked")
  @Options(flushCache=Options.FlushCachePolicy.TRUE,useCache=false)
  int lock(@Param("key") String key);
  @Select("select count(*) from ai_policies where tenant_id=#{tenant}")
  int countVersions(@Param("tenant") String tenant);
  @Select("""
      select count(*) from ai_policies where tenant_id=#{tenant} and status='published'
      and policy_key != #{excludedKey} and jsonb_exists(content::jsonb->'subjectTypes',#{subjectType})
      """)
  int countPublishedForSubject(@Param("tenant") String tenant,@Param("subjectType") String subjectType,
      @Param("excludedKey") String excludedKey);
  @Select("""
      select id,policy_key,version,title,content,status,source_hash,created_by,created_at from ai_policies
      where tenant_id=#{tenant} and status='published'
      and jsonb_exists(content::jsonb->'subjectTypes',#{subjectType}) order by policy_key limit 51
      """)
  List<PolicyRow> publishedForSubject(@Param("tenant") String tenant,@Param("subjectType") String subjectType);
  @Select("select coalesce(max(version),0) from ai_policies where tenant_id=#{tenant} and policy_key=#{key}")
  int latest(@Param("tenant") String tenant, @Param("key") String key);
  @Select("select id,policy_key,version,title,content,status,source_hash,created_by,created_at from ai_policies where tenant_id=#{tenant} order by policy_key,version desc limit 201")
  List<PolicyRow> list(@Param("tenant") String tenant);
  @Select("select id,policy_key,version,title,content,status,source_hash,created_by,created_at from ai_policies where tenant_id=#{tenant} and id=#{id}")
  PolicyRow find(@Param("tenant") String tenant, @Param("id") String id);
  @Insert("""
      insert into ai_policies(id,tenant_id,policy_key,version,title,content,status,source_hash,created_by)
      values(#{id},#{tenant},#{key},#{version},#{title},#{content},'draft',#{hash},#{user})
      """)
  void insert(@Param("id") String id, @Param("tenant") String tenant, @Param("key") String key,
      @Param("version") int version, @Param("title") String title, @Param("content") String content,
      @Param("hash") String hash, @Param("user") String user);
  @Update("update ai_policies set status='retired' where tenant_id=#{tenant} and policy_key=#{key} and status='published'")
  void retirePublished(@Param("tenant") String tenant, @Param("key") String key);
  @Update("update ai_policies set status=#{status} where tenant_id=#{tenant} and id=#{id} and status=#{expected}")
  int transition(@Param("tenant") String tenant, @Param("id") String id,
      @Param("expected") String expected, @Param("status") String status);
}
