package com.procurement.finance.infrastructure;

/** Shared SQL scopes for buyer finance reads, exports and record authorization. */
public final class FinanceScopeSql {
  private FinanceScopeSql() {}

  public static final String ORDERS = com.procurement.common.data.ProcurementScopeSql.ORDERS;

  public static final String INVOICES = "select scope_i.id from invoices scope_i where scope_i.tenant_id = #{tenantId} and scope_i.order_id in ("
      + ORDERS + ")";

  // A partial match must not expose a mixed batch's totals or authorize a batch-wide action.
  public static final String BATCHES = """
      select scope_pb.payment_batch_no from payment_batches scope_pb
      where scope_pb.tenant_id = #{tenantId}
      <if test="scope.restricted">
        and exists (select 1 from payment_requests scope_pr
          where scope_pr.tenant_id = scope_pb.tenant_id and scope_pr.payment_batch_no = scope_pb.payment_batch_no)
        and not exists (select 1 from payment_requests scope_pr
          where scope_pr.tenant_id = scope_pb.tenant_id and scope_pr.payment_batch_no = scope_pb.payment_batch_no
            and (scope_pr.order_id is null or scope_pr.order_id not in (
      """ + ORDERS + "))) </if>";
}
