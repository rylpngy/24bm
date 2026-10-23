package com.procurement.finance.infrastructure;

import com.procurement.finance.domain.PaymentReviewNote;
import com.procurement.identity.domain.DataScope;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface PaymentReviewMapper {
  String FILTER = """
      from invoices i where i.tenant_id=#{tenantId}
      and i.order_id in (
      """ + FinanceScopeSql.ORDERS + """
      )
      <if test="keyword != ''">
        and (position(lower(#{keyword}) in lower(coalesce(i.invoice_no,''))) > 0
          or position(lower(#{keyword}) in lower(i.id)) > 0
          or position(lower(#{keyword}) in lower(coalesce(i.order_id,''))) > 0)
      </if>
      <if test="paymentStatus != ''">and i.payment_status=#{paymentStatus}</if>
      """;

  @Select("<script>select i.id " + FILTER + " order by i.created_at desc,i.id limit #{limit} offset #{offset}</script>")
  List<String> page(@Param("tenantId") String tenantId, @Param("scope") DataScope scope,
      @Param("keyword") String keyword, @Param("paymentStatus") String paymentStatus,
      @Param("limit") int limit, @Param("offset") long offset);

  @Select("<script>select count(*) " + FILTER + "</script>")
  long count(@Param("tenantId") String tenantId, @Param("scope") DataScope scope,
      @Param("keyword") String keyword, @Param("paymentStatus") String paymentStatus);

  @Select("""
      select id,tenant_id,invoice_id,idempotency_key,reported_paid_amount,evidence_reference,
        explanation,snapshot,created_by,created_at from invoice_payment_review_notes
      where tenant_id=#{tenant} and invoice_id=#{invoice} order by created_at desc,id
      limit #{limit} offset #{offset}
      """)
  List<PaymentReviewNote> notes(@Param("tenant") String tenant, @Param("invoice") String invoice,
      @Param("limit") int limit, @Param("offset") long offset);

  @Select("select count(*) from invoice_payment_review_notes where tenant_id=#{tenant} and invoice_id=#{invoice}")
  long noteCount(@Param("tenant") String tenant, @Param("invoice") String invoice);

  @Select("""
      select id,tenant_id,invoice_id,idempotency_key,reported_paid_amount,evidence_reference,
        explanation,snapshot,created_by,created_at from invoice_payment_review_notes
      where tenant_id=#{tenant} and invoice_id=#{invoice} and idempotency_key=#{key}
      """)
  PaymentReviewNote findKey(@Param("tenant") String tenant, @Param("invoice") String invoice, @Param("key") String key);

  @Insert("""
      insert into invoice_payment_review_notes(id,tenant_id,invoice_id,idempotency_key,reported_paid_amount,
        evidence_reference,explanation,snapshot,created_by)
      values(#{id},#{tenantId},#{invoiceId},#{idempotencyKey},#{reportedPaidAmount},#{evidenceReference},
        #{explanation},#{snapshot},#{createdBy})
      """)
  void insert(PaymentReviewNote note);
}
