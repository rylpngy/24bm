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
      // Supplier remediation is part of profile collaboration, not buyer evaluation administration.
      Map.entry("performance-tasks", "profile"), Map.entry("cooperation-invitations", "profile"),
      Map.entry("esign-records", "esign"));

  private PortalPermissionPolicy() {}

  public static String required(String scope, String method, String path) {
    String prefix = "/api/v1/" + scope + "/";
    if (!path.startsWith(prefix)) return scope + ":*";
    String[] segments = path.substring(prefix.length()).split("/");
    if ((scope.equals("buyer") || scope.equals("supplier")) && segments.length == 4
        && segments[0].equals("mall") && segments[1].equals("orders") && segments[3].equals("checkout-note")) {
      return isRead(method) ? scope + ":order:read" : scope + ":*";
    }
    if (scope.equals("buyer")) {
      if(segments.length>=4&&segments[0].equals("invoices")&&segments[2].equals("payment-ledger")&&segments[3].equals("corrections"))
        return isRead(method)?"buyer:invoice:read":"buyer:payment:reverse";
      if (segments[0].equals("identity-bindings")) return "buyer:role:manage";
      if (segments[0].equals("ai")) return buyerAiPermission(method, segments);
      if (segments[0].equals("numbering-rules")) {
        boolean supported = segments.length == 1 && isRead(method)
            || segments.length == 2 && method.equals("PUT")
            || segments.length == 3 && segments[2].equals("preview") && method.equals("POST");
        return supported ? "buyer:role:manage" : "buyer:*";
      }
      if (segments[0].equals("rfqs")) return buyerRfqPermission(method, segments);
      if (segments[0].equals("auction-stream")) {
        return segments.length == 1 && isRead(method) ? "buyer:rfq:read" : "buyer:*";
      }
      if (segments[0].equals("mall")) {
        String area = segments.length > 1 ? segments[1] : "";
        if (area.equals("products") && segments.length >= 4 && segments[3].equals("review-media")) return "buyer:mall:manage";
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
        case "projects" -> "project";
        case "tenders" -> "tender";
        case "orders", "deliveries" -> "order";
        case "receipts" -> "receipt";
        case "suppliers", "supplier-invitations", "supplier-evaluation-templates" -> "supplier";
        case "analytics" -> "analytics";
        case "budgets" -> "budget";
        case "funding" -> "budget";
        case "audit-logs" -> "audit";
        default -> null;
      };
      if (module == null) return "buyer:*";
      if (segments[0].equals("orders") && segments.length >= 3 && segments[2].equals("receipts")) module = "receipt";
      if (segments[0].equals("suppliers") && segments.length >= 3 && segments[2].equals("approval")) return "buyer:workflow:review";
      if (segments[0].equals("suppliers") && segments.length >= 3 && segments[2].equals("exit-risk")) return "buyer:supplier:manage";
      if (segments[0].equals("suppliers") && segments.length == 3 && segments[2].equals("exit-items")
          && (method.equals("GET") || method.equals("HEAD"))) return "buyer:supplier:read";
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

  private static boolean isRead(String method) {
    return method.equals("GET") || method.equals("HEAD");
  }

  private static String buyerAiPermission(String method, String[] segments) {
    if (segments.length >= 2 && segments[1].equals("policies")) {
      boolean supported = segments.length == 2 && (isRead(method) || method.equals("POST"))
          || segments.length == 3 && isRead(method)
          || segments.length == 4 && method.equals("POST")
              && java.util.Set.of("publish", "retire").contains(segments[3]);
      return supported ? "buyer:ai:manage" : "buyer:*";
    }
    if (segments.length >= 2 && segments[1].equals("reviews")) {
      if (isRead(method) && (segments.length == 2 || segments.length == 3)) return "buyer:ai:read";
      if (method.equals("POST") && (segments.length == 2
          || segments.length == 4 && segments[3].equals("feedback"))) return "buyer:ai:use";
    }
    return "buyer:*";
  }

  private static String buyerRfqPermission(String method, String[] segments) {
    boolean read = isRead(method);
    boolean post = method.equals("POST");
    boolean manage = false;
    if (segments.length == 1) {
      if (read) return "buyer:rfq:read";
      manage = post;
    } else if (segments.length == 2) {
      manage = method.equals("PUT");
    } else if (segments.length == 3) {
      String action = segments[2];
      if (read && java.util.Set.of("supplier-performance", "notice", "notice.pdf", "result",
          "announcements", "enrollments", "clarifications", "evaluation", "execution").contains(action)) {
        return "buyer:rfq:read";
      }
      manage = method.equals("PUT") && action.equals("invitations")
          || post && java.util.Set.of("open", "publish", "remind", "abort", "new-round", "award").contains(action);
    } else if (segments.length == 4) {
      String action = segments[2] + "/" + segments[3];
      if (post && action.equals("award/approval")) return "buyer:workflow:review";
      if (read && action.equals("notice/verify")) return "buyer:rfq:read";
      manage = post && java.util.Set.of("notice/issue", "result/announce", "clarifications/bulletin",
          "execution/archives").contains(action);
    } else if (segments.length == 5) {
      manage = post && (segments[2].equals("clarifications") && segments[4].equals("answer")
          || segments[2].equals("enrollments") && java.util.Set.of("accept", "dismiss").contains(segments[4]));
    } else if (segments.length == 6 && read && segments[2].equals("execution")
        && segments[3].equals("archives") && segments[5].equals("download")) {
      return "buyer:rfq:read";
    }
    return manage ? "buyer:rfq:manage" : "buyer:*";
  }
}
