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
      case "V207__demo_invoice.sql" -> List.of("deliveries", "receipts");
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
        // Only the two original seed inserts need an ON CONFLICT arbiter. DDL shares
        // their transaction: a failed seed rolls it back, and success removes it.
        for (String table : legacyTables(context)) {
          String index = "seed_compat_" + table + "_order_uidx";
          statement.execute("create unique index " + index + " on public." + table + " (tenant_id, order_id)");
          createdIndexes.add(index);
        }
      } else {
        for (String index : createdIndexes) statement.execute("drop index public." + index);
        createdIndexes.clear();
      }
    } catch (SQLException error) {
      throw new IllegalStateException("Historical demo fulfillment seed could not run safely; do not enable demo seeding on business databases", error);
    }
  }

  @Override public String getCallbackName() { return "legacy-fulfillment-demo-seed"; }
}
