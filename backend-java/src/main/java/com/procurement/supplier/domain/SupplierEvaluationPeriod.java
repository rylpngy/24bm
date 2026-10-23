package com.procurement.supplier.domain;

import java.util.Locale;

/** Canonical period identity shared by assignments and free-form evaluations. */
public final class SupplierEvaluationPeriod {
  // The Character.isWhitespace set used by String.strip(), also supplied to PostgreSQL btrim.
  public static final String STRIP_CHARACTERS = "\t\n\u000b\f\r\u001c\u001d\u001e\u001f "
      + "\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2008\u2009\u200a\u2028\u2029\u205f\u3000";

  private SupplierEvaluationPeriod() {}

  public static String normalize(String period) {
    String value = period == null ? "" : period.strip().toUpperCase(Locale.ROOT);
    if (!value.matches("[1-9][0-9]{3}(-Q[1-4]|-(0[1-9]|1[0-2]))?")) {
      throw new IllegalArgumentException("考核周期格式须为 YYYY、YYYY-Qn 或 YYYY-MM");
    }
    return value;
  }
}
