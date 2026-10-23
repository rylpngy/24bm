package com.procurement.attachment.infrastructure;

import com.procurement.attachment.domain.AttachmentUploadTicket;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface AttachmentUploadTicketMapper {
  @Insert("""
      insert into attachment_upload_tickets
        (storage_key, tenant_id, user_id, owner_type, owner_id, file_name, visibility,
         token_hash, state, created_at, expires_at)
      values (#{storageKey}, #{tenantId}, #{userId}, #{ownerType}, #{ownerId}, #{fileName},
        #{visibility}, #{tokenHash}, 'issued', #{createdAt}, #{expiresAt})
      """)
  void insert(AttachmentUploadTicket ticket);

  @Select("""
      select storage_key,tenant_id,user_id,owner_type,owner_id,file_name,visibility,token_hash,state,created_at,expires_at
      from attachment_upload_tickets where tenant_id = #{tenantId}
        and storage_key = #{storageKey} and user_id = #{userId}
      """)
  AttachmentUploadTicket find(@Param("tenantId") String tenantId, @Param("storageKey") String storageKey,
      @Param("userId") String userId);

  @Update("""
      update attachment_upload_tickets set state = 'uploading'
      where tenant_id = #{tenantId} and storage_key = #{storageKey} and user_id = #{userId}
        and token_hash = #{tokenHash} and state = 'issued' and expires_at > clock_timestamp()
      """)
  int claim(@Param("tenantId") String tenantId, @Param("storageKey") String storageKey,
      @Param("userId") String userId, @Param("tokenHash") String tokenHash);

  @Update("""
      update attachment_upload_tickets set state = #{state}
      where tenant_id = #{tenantId} and storage_key = #{storageKey} and user_id = #{userId} and state = 'uploading'
      """)
  int finish(@Param("tenantId") String tenantId, @Param("storageKey") String storageKey,
      @Param("userId") String userId, @Param("state") String state);

  @Update("""
      update attachment_upload_tickets set state='uploaded',content_size=#{size},content_sha256=#{sha256}
      where tenant_id=#{tenantId} and storage_key=#{storageKey} and user_id=#{userId} and state='uploading'
      """)
  int finishUploaded(@Param("tenantId") String tenantId, @Param("storageKey") String storageKey,
      @Param("userId") String userId, @Param("size") long size, @Param("sha256") String sha256);

  @Update("""
      update attachment_upload_tickets set state = 'registered'
      where tenant_id = #{tenantId} and storage_key = #{storageKey} and user_id = #{userId}
        and owner_type = #{ownerType} and owner_id = #{ownerId} and file_name = #{fileName}
        and visibility = #{visibility} and state = 'uploaded' and expires_at > clock_timestamp()
      """)
  int consume(@Param("tenantId") String tenantId, @Param("storageKey") String storageKey,
      @Param("userId") String userId, @Param("ownerType") String ownerType,
      @Param("ownerId") String ownerId, @Param("fileName") String fileName,
      @Param("visibility") String visibility);
}
