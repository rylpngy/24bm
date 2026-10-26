package com.procurement.common.seed;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import org.flywaydb.core.api.callback.Callback;
import org.flywaydb.core.api.callback.Context;
import org.flywaydb.core.api.callback.Event;

/** Preserves historical demo SQL/checksums without retaining single-batch business constraints. */
public final class LegacyFulfillmentSeedCallback implements Callback {
  private final List<String> createdIndexes = new ArrayList<>();

  private List<String> legacyTables(Context context) {
    if (context.getMigrationInfo() == null) return List.of();
    return switch (context.getMigrationInfo().getScript()) {
      case "V206__demo_fulfillment_order.sql" -> List.of("deliveries");
      case "V207__demo_invoice.sql" -> List.of("deliveries", "receipts", "invoices");
      case "V219__demo_payment_batch.sql", "V223__demo_variance.sql", "V229__demo_large_variance.sql",
          "V100__local_demo_seed.sql", "V115__contract_demo_seed.sql", "V121__stage_seven_real_action_demo_seed.sql" -> List.of("invoices");
      default -> List.of();
    };
  }

  @Override public boolean supports(Event event, Context context) {
    return (event == Event.BEFORE_EACH_MIGRATE || event == Event.AFTER_EACH_MIGRATE)
        && !legacyTables(context).isEmpty();
  }

  @Override public boolean canHandleInTransaction(Event event, Context context) { return true; }

  @Override public void handle(Event event, Context context) {
    try (var statement = context.getConnection().createStatement()) {
      if (event == Event.BEFORE_EACH_MIGRATE) {
        // Exact historical seed scripts retain their checksums. DDL shares their
        // transaction and table lock, so normal business writes never bypass the cap.
        if (legacyTables(context).contains("invoices"))
          statement.execute("alter table public.invoices disable trigger protect_order_invoice_total");
        for (String table : legacyTables(context)) {
          String index = "seed_compat_" + table + "_order_uidx";
          statement.execute("create unique index " + index + " on public." + table + " (tenant_id, order_id)");
          createdIndexes.add(index);
        }
      } else {
        for (String index : createdIndexes) statement.execute("drop index public." + index);
        createdIndexes.clear();
        if (legacyTables(context).contains("invoices"))
          statement.execute("alter table public.invoices enable trigger protect_order_invoice_total");
      }
    } catch (SQLException error) {
      throw new IllegalStateException("Historical demo fulfillment seed could not run safely; do not enable demo seeding on business databases", error);
    }
  }

  @Override public String getCallbackName() { return "legacy-fulfillment-demo-seed"; }
}
