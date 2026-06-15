package com.procurement.order.infrastructure;

import com.procurement.order.domain.Receipt;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ReceiptMapper {

  @Insert("""
      insert into receipts (id, tenant_id, order_id, receiver_id, result)
      values (#{id}, #{tenantId}, #{orderId}, #{receiverId}, #{result})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("orderId") String orderId,
      @Param("receiverId") String receiverId,
      @Param("result") String result);

  @Select("""
      select id, tenant_id, order_id, receiver_id, result, received_at
      from receipts
      where tenant_id = #{tenantId} and id = #{id}
      """)
  @Results(id = "receiptResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "order_id", property = "orderId"),
      @Result(column = "receiver_id", property = "receiverId"),
      @Result(column = "received_at", property = "receivedAt")
  })
  Receipt findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("""
      select count(1)
      from receipts
      where tenant_id = #{tenantId}
        and order_id = #{orderId}
      """)
  int countByTenantAndOrder(@Param("tenantId") String tenantId, @Param("orderId") String orderId);

  @Select("""
      select id, tenant_id, order_id, receiver_id, result, received_at
      from receipts
      where tenant_id = #{tenantId}
        and (#{orderId} is null or order_id = #{orderId})
        and (#{receiverId} is null or receiver_id = #{receiverId})
      order by received_at desc
      """)
  @Results(id = "receiptListResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "order_id", property = "orderId"),
      @Result(column = "receiver_id", property = "receiverId"),
      @Result(column = "received_at", property = "receivedAt")
  })
  List<Receipt> listByTenantFiltered(
      @Param("tenantId") String tenantId,
      @Param("orderId") String orderId,
      @Param("receiverId") String receiverId);
}
