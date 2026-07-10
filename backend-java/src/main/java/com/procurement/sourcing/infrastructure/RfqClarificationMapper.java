package com.procurement.sourcing.infrastructure;

import com.procurement.sourcing.domain.RfqClarification;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface RfqClarificationMapper {

  // 列序与 RfqClarification 记录字段一一对应(MyBatis 按位置映射)。
  String COLS =
      "id, tenant_id, rfq_id, supplier_id, question, answer, answered_by, published, asked_at, answered_at";

  // 采购方:看该 RFQ 全部澄清(含未答复/未广播)。
  @Select("select " + COLS + " from rfq_clarifications "
      + "where tenant_id = #{tenantId} and rfq_id = #{rfqId} order by asked_at")
  List<RfqClarification> listByTenantAndRfq(
      @Param("tenantId") String tenantId, @Param("rfqId") String rfqId);

  // 供应商:看自己提的问题 + 已广播的答复(同租户同 RFQ 作用域)。
  @Select("select " + COLS + " from rfq_clarifications "
      + "where tenant_id = #{tenantId} and rfq_id = #{rfqId} "
      + "and (supplier_id = #{supplierId} or published = true) order by asked_at")
  List<RfqClarification> listForSupplier(
      @Param("tenantId") String tenantId,
      @Param("rfqId") String rfqId,
      @Param("supplierId") String supplierId);

  @Select("select " + COLS + " from rfq_clarifications "
      + "where tenant_id = #{tenantId} and id = #{id}")
  RfqClarification findByTenantAndId(
      @Param("tenantId") String tenantId, @Param("id") String id);

  @Insert("insert into rfq_clarifications (id, tenant_id, rfq_id, supplier_id, question) "
      + "values (#{id}, #{tenantId}, #{rfqId}, #{supplierId}, #{question})")
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("rfqId") String rfqId,
      @Param("supplierId") String supplierId,
      @Param("question") String question);

  @Update("update rfq_clarifications set answer = #{answer}, answered_by = #{answeredBy}, "
      + "published = #{published}, answered_at = now() "
      + "where tenant_id = #{tenantId} and id = #{id}")
  int answer(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("answer") String answer,
      @Param("answeredBy") String answeredBy,
      @Param("published") boolean published);
}
