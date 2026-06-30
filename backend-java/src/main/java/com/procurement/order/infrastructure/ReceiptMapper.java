package com.procurement.order.infrastructure;

import com.procurement.order.domain.Receipt;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ReceiptMapper {

  @Insert("""
      insert into receipts (id, tenant_id, order_id, receiver_id, result,
                            received_quantity, qualified_quantity, quality_note,
                            inspection_conclusion, disposition, disposition_note)
      values (#{id}, #{tenantId}, #{orderId}, #{receiverId}, #{result},
              #{receivedQuantity}, #{qualifiedQuantity}, #{qualityNote},
              #{inspectionConclusion}, #{disposition}, #{dispositionNote})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("orderId") String orderId,
      @Param("receiverId") String receiverId,
      @Param("result") String result,
      @Param("receivedQuantity") Integer receivedQuantity,
      @Param("qualifiedQuantity") Integer qualifiedQuantity,
      @Param("qualityNote") String qualityNote,
      @Param("inspectionConclusion") String inspectionConclusion,
      @Param("disposition") String disposition,
      @Param("dispositionNote") String dispositionNote);

  @Select("""
      select id, tenant_id, order_id, receiver_id, result, received_at, received_quantity, qualified_quantity, quality_note, inspection_conclusion, disposition, disposition_note
      from receipts
      where tenant_id = #{tenantId} and id = #{id}
      """)
  Receipt findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("""
      select id, tenant_id, order_id, receiver_id, result, received_at, received_quantity, qualified_quantity, quality_note, inspection_conclusion, disposition, disposition_note
      from receipts
      where tenant_id = #{tenantId}
        and order_id = #{orderId,jdbcType=VARCHAR}
      order by received_at desc
      limit 1
      """)
  Receipt findByTenantAndOrder(@Param("tenantId") String tenantId, @Param("orderId") String orderId);

  @Select("""
      select count(1)
      from receipts
      where tenant_id = #{tenantId}
        and order_id = #{orderId,jdbcType=VARCHAR}
      """)
  int countByTenantAndOrder(@Param("tenantId") String tenantId, @Param("orderId") String orderId);

  @Select("""
      <script>
      select id, tenant_id, order_id, receiver_id, result, received_at, received_quantity, qualified_quantity, quality_note, inspection_conclusion, disposition, disposition_note
      from receipts
      where tenant_id = #{tenantId}
        <if test="orderId != null and orderId != ''">
        and order_id = #{orderId}
        </if>
        <if test="receiverId != null and receiverId != ''">
        and receiver_id = #{receiverId}
        </if>
      order by received_at desc
      </script>
      """)
  List<Receipt> listByTenantFiltered(
      @Param("tenantId") String tenantId,
      @Param("orderId") String orderId,
      @Param("receiverId") String receiverId);
}
