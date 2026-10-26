package com.procurement.order.infrastructure;

import com.procurement.order.domain.Receipt;
import com.procurement.order.domain.ReceiptDispositionReview;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface ReceiptDispositionReviewMapper {
  @Select("select count(*) from receipt_after_sales_resolutions where tenant_id=#{tenant} and receipt_id=#{receipt}")
  int qualityResolutions(@Param("tenant")String tenant,@Param("receipt")String receipt);
  @Select("select id from rfqs where tenant_id=#{tenant} and id=#{rfq} for update")
  String lockRfq(@Param("tenant") String tenant, @Param("rfq") String rfq);

  @Select("""
      select id,tenant_id,order_id,receiver_id,result,received_at,received_quantity,qualified_quantity,
        quality_note,inspection_conclusion,disposition,disposition_note
      from receipts where tenant_id=#{tenant} and id=#{receipt} for update
      """)
  Receipt lockReceipt(@Param("tenant") String tenant, @Param("receipt") String receipt);

  @Select("select id from invoices where tenant_id=#{tenant} and order_id=#{order} order by id for update")
  List<String> lockInvoices(@Param("tenant") String tenant, @Param("order") String order);

  @Select("select id from contracts where tenant_id=#{tenant} and related_order_id=#{order} order by id for update")
  List<String> lockContracts(@Param("tenant") String tenant, @Param("order") String order);

  @Select("""
      select (select count(*) from procurement_execution_archives where tenant_id=#{tenant} and rfq_id=#{rfq})
        + (select count(*) from contracts where tenant_id=#{tenant} and related_order_id=#{order} and archive_status='已归档')
        + (select count(*) from invoices i where i.tenant_id=#{tenant} and i.order_id=#{order}
            and (i.payment_status is null or i.payment_status not in ('待付款','未付款')
              or exists (select 1 from invoice_payment_entries e where e.tenant_id=i.tenant_id and e.invoice_id=i.id)))
      """)
  int countFrozenEvidence(@Param("tenant") String tenant, @Param("order") String order, @Param("rfq") String rfq);

  @Select("""
      select id,tenant_id,receipt_id,decision,reason,evidence_no,reviewed_by,reviewed_at
      from receipt_disposition_reviews where tenant_id=#{tenant} and receipt_id=#{receipt}
      """)
  ReceiptDispositionReview find(@Param("tenant") String tenant, @Param("receipt") String receipt);

  @Insert("""
      insert into receipt_disposition_reviews(id,tenant_id,receipt_id,decision,reason,evidence_no,reviewed_by)
      values (#{id},#{tenantId},#{receiptId},#{decision},#{reason},#{evidenceNo},#{reviewedBy})
      """)
  void insert(ReceiptDispositionReview review);
}
