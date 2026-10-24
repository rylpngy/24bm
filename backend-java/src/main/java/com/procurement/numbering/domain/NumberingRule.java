package com.procurement.numbering.domain;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Set;

/** Formatting only. Sequence ownership is global by rendered prefix, not tenant or rule revision. */
public record NumberingRule(String businessType, String prefix, String dateFormat, int width, boolean enabled) {
  public static final Set<String> TYPES = Set.of("demand", "tender");
  public static final Set<String> DATE_FORMATS = Set.of("none", "yyyy", "yyyyMM", "yyyyMMdd");

  public NumberingRule validated(String type) {
    if (!TYPES.contains(type) || !type.equals(businessType)) {
      throw new IllegalArgumentException("Only demand and tender automatic numbering are configurable");
    }
    if (prefix == null || !prefix.matches("[A-Za-z0-9_-]{0,20}") || (enabled && prefix.isEmpty())) {
      throw new IllegalArgumentException("Prefix must contain 1-20 letters, digits, hyphens or underscores");
    }
    if (dateFormat == null || !DATE_FORMATS.contains(dateFormat) || width < 1 || width > 9) {
      throw new IllegalArgumentException("Date format must be none/yyyy/yyyyMM/yyyyMMdd and width must be 1-9");
    }
    return this;
  }

  public String renderedPrefix(LocalDate date) {
    return prefix + ("none".equals(dateFormat) ? "" : date.format(DateTimeFormatter.ofPattern(dateFormat, Locale.ROOT)));
  }

  public String format(String renderedPrefix, long sequence) {
    return renderedPrefix + String.format(Locale.ROOT, "%0" + width + "d", sequence);
  }

  public static NumberingRule defaults(String type) {
    if (!TYPES.contains(type)) throw new IllegalArgumentException("Unsupported automatic numbering type: " + type);
    return new NumberingRule(type, "tender".equals(type) ? "ZB" : "", "yyyyMMdd", 3, false);
  }

  public static String departmentPrefix(String departmentId) {
    if (departmentId == null) return "GEN";
    return switch (departmentId) {
      case "dept-it" -> "IT";
      case "dept-finance" -> "FIN";
      case "dept-admin" -> "ADM";
      case "dept-purchase" -> "PUR";
      case "dept-hq" -> "HQ";
      default -> {
        String letters = departmentId.replace("dept-", "").replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
        yield letters.isBlank() ? "GEN" : letters.substring(0, Math.min(3, letters.length()));
      }
    };
  }
}
