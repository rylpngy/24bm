package com.procurement.finance.infrastructure;

import com.procurement.finance.domain.PaymentEntry;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface PaymentEntryMapper {
  @Select("select * from invoice_payment_entries where tenant_id=#{tenant} and invoice_id=#{invoice} order by created_at,id")
  List<PaymentEntry> list(@Param("tenant") String tenant, @Param("invoice") String invoice);

  @Select("select coalesce(sum(amount),0) from invoice_payment_entries where tenant_id=#{tenant} and invoice_id=#{invoice}")
  BigDecimal balance(@Param("tenant") String tenant, @Param("invoice") String invoice);

  @Select("select * from invoice_payment_entries where tenant_id=#{tenant} and invoice_id=#{invoice} and idempotency_key=#{key}")
  PaymentEntry findKey(@Param("tenant") String tenant, @Param("invoice") String invoice, @Param("key") String key);

  @Insert("""
      insert into invoice_payment_entries(id,tenant_id,invoice_id,idempotency_key,amount,milestone_id,evidence_no,remark,reversal_of,created_by)
      values(#{id},#{tenantId},#{invoiceId},#{idempotencyKey},#{amount},#{milestoneId},#{evidenceNo},#{remark},#{reversalOf},#{createdBy})
      """)
  void insert(PaymentEntry entry);
}
