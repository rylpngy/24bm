package com.procurement.identity.security;

import java.util.Map;

/** HTTP permission boundary; business services still enforce ownership and state transitions. */
public final class PortalPermissionPolicy {
  private static final Map<String, String> PLATFORM = Map.of(
      "tenants", "tenant", "enterprise-reviews", "enterprise", "announcements", "announcement",
      "suppliers", "supplier", "dictionaries", "dictionary");
  private static final Map<String, String> SUPPLIER = Map.ofEntries(
      Map.entry("orders", "order"), Map.entry("deliveries", "delivery"),
      Map.entry("invoices", "invoice"), Map.entry("invoice-reconciliations", "invoice"),
      Map.entry("rfqs", "rfq"), Map.entry("quotes", "rfq"), Map.entry("auction-stream", "rfq"),
      Map.entry("tenders", "tender"), Map.entry("mall", "mall"), Map.entry("profile", "profile"),
      Map.entry("qualifications", "qualification"), Map.entry("users", "user"),
      Map.entry("notifications", "notification"), Map.entry("announcements", "announcement"),
      Map.entry("esign-records", "esign"));

  private PortalPermissionPolicy() {}

  public static String required(String scope, String method, String path) {
    String prefix = "/api/v1/" + scope + "/";
    if (!path.startsWith(prefix)) return scope + ":*";
    String[] segments = path.substring(prefix.length()).split("/");
    if (scope.equals("buyer")) {
      if (segments[0].equals("mall")) {
        String area = segments.length > 1 ? segments[1] : "";
        boolean read = method.equals("GET") || method.equals("HEAD");
        if (area.equals("analytics")) return "buyer:analytics:read";
        if (area.equals("after-sales") || area.equals("reviews")) {
          return read ? "buyer:order:read" : "buyer:mall:purchase";
        }
        if (area.equals("products") && (path.endsWith("/pending-review") || path.endsWith("/review"))) {
          return "buyer:mall:manage";
        }
        if (read) return "buyer:mall:read";
        return "buyer:mall:" + (area.equals("cart") || area.equals("orders") ? "purchase" : "manage");
      }
      String module = switch (segments[0]) {
        case "tenders" -> "tender";
        case "orders", "deliveries" -> "order";
        case "receipts" -> "receipt";
        case "suppliers", "supplier-invitations" -> "supplier";
        case "analytics" -> "analytics";
        case "budgets" -> "budget";
        case "audit-logs" -> "audit";
        default -> null;
      };
      if (module == null) return "buyer:*";
      if (segments[0].equals("orders") && segments.length >= 3 && segments[2].equals("receipts")) module = "receipt";
      if (segments[0].equals("suppliers") && segments.length >= 3 && segments[2].equals("approval")) return "buyer:workflow:review";
      if (segments[0].equals("suppliers") && segments.length >= 3 && segments[2].equals("exit-risk")) return "buyer:supplier:manage";
      if (segments[0].equals("suppliers") && segments.length >= 4 && segments[1].equals("qualification-reviews") && segments[3].equals("review")) return "buyer:workflow:review";
      return "buyer:" + module + (method.equals("GET") || method.equals("HEAD") ? ":read" : ":manage");
    }
    String module = (scope.equals("platform") ? PLATFORM : SUPPLIER).get(segments[0]);
    // Aggregate workspaces and unknown endpoints are reserved for full-scope administrators.
    if (module == null) return scope + ":*";
    // Team mutations remain administrator-only; ordinary business members cannot manage accounts.
    if (scope.equals("supplier") && segments[0].equals("users")
        && !method.equals("GET") && !method.equals("HEAD")) return "supplier:*";
    if (scope.equals("supplier") && segments[0].equals("orders") && segments.length >= 3) {
      if (segments[2].equals("deliveries")) module = "delivery";
      if (segments[2].equals("invoices")) module = "invoice";
    }
    if (scope.equals("platform") && segments[0].equals("tenants") && segments.length >= 3
        && (segments[2].equals("usage") || segments[2].equals("billing-statements"))) module = "billing";
    return scope + ":" + module + (method.equals("GET") || method.equals("HEAD") ? ":read" : ":manage");
  }
}
