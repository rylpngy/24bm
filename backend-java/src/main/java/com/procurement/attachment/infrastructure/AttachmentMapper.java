package com.procurement.attachment.infrastructure;

import com.procurement.attachment.domain.Attachment;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface AttachmentMapper {

  @Select("""
      select id, tenant_id, owner_type, owner_id, file_name, storage_key, uploaded_by, visibility, status, created_at
      from attachments
      where tenant_id = #{tenantId}
        and owner_type = #{ownerType}
        and owner_id = #{ownerId}
        and status = 'active'
      order by created_at desc
      """)
  @Results(id = "attachmentResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "owner_type", property = "ownerType"),
      @Result(column = "owner_id", property = "ownerId"),
      @Result(column = "file_name", property = "fileName"),
      @Result(column = "storage_key", property = "storageKey"),
      @Result(column = "uploaded_by", property = "uploadedBy"),
      @Result(column = "created_at", property = "createdAt")
  })
  List<Attachment> listActiveByTenantAndOwner(
      @Param("tenantId") String tenantId,
      @Param("ownerType") String ownerType,
      @Param("ownerId") String ownerId);

  @Select("""
      select id, tenant_id, owner_type, owner_id, file_name, storage_key, uploaded_by, visibility, status, created_at
      from attachments
      where tenant_id = #{tenantId} and id = #{id}
      """)
  @Results(id = "singleAttachmentResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "owner_type", property = "ownerType"),
      @Result(column = "owner_id", property = "ownerId"),
      @Result(column = "file_name", property = "fileName"),
      @Result(column = "storage_key", property = "storageKey"),
      @Result(column = "uploaded_by", property = "uploadedBy"),
      @Result(column = "created_at", property = "createdAt")
  })
  Attachment findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Insert("""
      insert into attachments (id, tenant_id, owner_type, owner_id, file_name, storage_key, uploaded_by, visibility, status)
      values (#{id}, #{tenantId}, #{ownerType}, #{ownerId}, #{fileName}, #{storageKey}, #{uploadedBy}, #{visibility}, #{status})
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
