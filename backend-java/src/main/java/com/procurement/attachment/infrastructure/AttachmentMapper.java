package com.procurement.attachment.infrastructure;

import com.procurement.attachment.domain.Attachment;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface AttachmentMapper {
 @org.apache.ibatis.annotations.Update("update attachments set content_size=#{size},content_sha256=#{hash} where tenant_id=#{tenant} and id=#{id}")
 int generatedFingerprint(String tenant,String id,long size,String hash);


  record Fingerprint(Long contentSize, String contentSha256) {}

  @Select("select content_size,content_sha256 from attachments where tenant_id=#{tenantId} and id=#{id}")
  Fingerprint fingerprint(@Param("tenantId") String tenantId, @Param("id") String id);

  @org.apache.ibatis.annotations.Update("""
      update attachments a set content_size=t.content_size,content_sha256=t.content_sha256
      from attachment_upload_tickets t
      where a.tenant_id=#{tenantId} and a.id=#{id} and t.tenant_id=a.tenant_id
        and t.storage_key=a.storage_key and t.owner_type=a.owner_type and t.owner_id=a.owner_id
        and t.user_id=a.uploaded_by and t.file_name=a.file_name and t.visibility=a.visibility
        and t.state='registered'
      """)
  int copyUploadFingerprint(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("""
      select id, tenant_id, owner_type, owner_id, file_name, storage_key, uploaded_by, visibility, status, created_at
      from attachments
      where tenant_id = #{tenantId}
        and owner_type = #{ownerType}
        and owner_id = #{ownerId}
        and status = 'active'
      order by created_at desc
      """)
  List<Attachment> listActiveByTenantAndOwner(
      @Param("tenantId") String tenantId,
      @Param("ownerType") String ownerType,
      @Param("ownerId") String ownerId);

  @Select("""
      select id, tenant_id, owner_type, owner_id, file_name, storage_key, uploaded_by, visibility, status, created_at
      from attachments
      where tenant_id = #{tenantId} and id = #{id}
      """)
  Attachment findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Insert("""
      insert into attachments (id, tenant_id, owner_type, owner_id, file_name, storage_key, uploaded_by, visibility, status)
      values (#{id}, #{tenantId}, #{ownerType}, #{ownerId}, #{fileName}, #{storageKey}, #{uploadedBy}, #{visibility}, #{status,jdbcType=VARCHAR})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("ownerType") String ownerType,
      @Param("ownerId") String ownerId,
      @Param("fileName") String fileName,
      @Param("storageKey") String storageKey,
      @Param("uploadedBy") String uploadedBy,
      @Param("visibility") String visibility,
      @Param("status") String status);
}
