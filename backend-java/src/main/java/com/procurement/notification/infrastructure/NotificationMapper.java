package com.procurement.notification.infrastructure;

import com.procurement.notification.domain.Notification;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface NotificationMapper {

  @Insert("""
      insert into notifications (id, tenant_id, recipient_id, title, content)
      values (#{id}, #{tenantId}, #{recipientId}, #{title}, #{content})
      on conflict (id) do nothing
      """)
  int insertOnce(String id, String tenantId, String recipientId, String title, String content);

  @Insert("""
      insert into notifications (id, tenant_id, recipient_id, title, content)
      values (#{id}, #{tenantId}, #{recipientId}, #{title}, #{content})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("recipientId") String recipientId,
      @Param("title") String title,
      @Param("content") String content);

  @Select("""
      select id, tenant_id, recipient_id, title, content, read_at, created_at
      from notifications
      where tenant_id = #{tenantId}
        and recipient_id = #{recipientId}
      order by created_at desc
      limit #{limit}
      """)
  List<Notification> listByTenantAndRecipient(
      @Param("tenantId") String tenantId,
      @Param("recipientId") String recipientId,
      @Param("limit") int limit);

  @Select("""
      select n.id, n.tenant_id, n.recipient_id, n.title, n.content, n.read_at, n.created_at
      from notifications n
      join users u on u.id = n.recipient_id
      where u.supplier_id = #{supplierId,jdbcType=VARCHAR}
        and u.tenant_id is null
        and n.recipient_id = #{recipientId}
      order by n.created_at desc
      limit #{limit}
      """)
  List<Notification> listBySupplierAndRecipient(
      @Param("supplierId") String supplierId,
      @Param("recipientId") String recipientId,
      @Param("limit") int limit);

  @Select("""
      select id, tenant_id, recipient_id, title, content, read_at, created_at
      from notifications
      where tenant_id = #{tenantId}
        and recipient_id = #{recipientId}
        and id = #{id}
      """)
  Notification findByTenantRecipientAndId(
      @Param("tenantId") String tenantId,
      @Param("recipientId") String recipientId,
      @Param("id") String id);

  @Select("""
      select n.id, n.tenant_id, n.recipient_id, n.title, n.content, n.read_at, n.created_at
      from notifications n
      join users u on u.id = n.recipient_id
      where u.supplier_id = #{supplierId,jdbcType=VARCHAR}
        and u.tenant_id is null
        and n.recipient_id = #{recipientId}
        and n.id = #{id}
      """)
  Notification findBySupplierRecipientAndId(
      @Param("supplierId") String supplierId,
      @Param("recipientId") String recipientId,
      @Param("id") String id);

  @Update("""
      update notifications
      set read_at = coalesce(read_at, now())
      where tenant_id = #{tenantId}
        and recipient_id = #{recipientId}
        and id = #{id}
      """)
  int markRead(
      @Param("tenantId") String tenantId,
      @Param("recipientId") String recipientId,
      @Param("id") String id);

  @Update("""
      update notifications n
      set read_at = coalesce(read_at, now())
      where n.recipient_id = #{recipientId}
        and n.id = #{id}
        and exists (
          select 1
          from users u
          where u.id = n.recipient_id
            and u.supplier_id = #{supplierId,jdbcType=VARCHAR}
            and u.tenant_id is null
        )
      """)
  int markReadBySupplierAndRecipient(
      @Param("supplierId") String supplierId,
      @Param("recipientId") String recipientId,
      @Param("id") String id);
}
