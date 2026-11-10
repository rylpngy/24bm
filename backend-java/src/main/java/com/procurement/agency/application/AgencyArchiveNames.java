package com.procurement.agency.application;

import java.text.Normalizer;
import java.util.*;

public final class AgencyArchiveNames {
  private AgencyArchiveNames() {}

  public static String safe(String name) {
    String value =
        Normalizer.normalize(Objects.toString(name, "file"), Normalizer.Form.NFC)
            .replaceAll("[\\p{Cntrl}/\\\\:*?\"<>|]", "_")
            .replace("..", "_")
            .strip()
            .replaceAll("^[. ]+|[. ]+$", "");
    if (value.isBlank()) value = "file";
    if (value.length() > 150) value = value.substring(0, 150);
    if (value.matches("(?i)(con|prn|aux|nul|com[1-9]|lpt[1-9])(\\..*)?")) value = "_" + value;
    return value;
  }

  public static String unique(String name, Set<String> used) {
    String safe = safe(name), candidate = safe;
    int n = 1;
    while (!used.add(candidate.toLowerCase(Locale.ROOT))) candidate = (n++) + "-" + safe;
    return candidate;
  }
}
