package com.procurement.attachment.domain;

import java.util.List;

public final class AttachmentVisibility {
  public static final String TENANT = "tenant";
  public static final String BUYER_INTERNAL = "buyer_internal";
  public static final String SUPPLIER_SHARED = "supplier_shared";

  private static final List<String> SUPPORTED_VISIBILITIES = List.of(
      TENANT,
      BUYER_INTERNAL,
      SUPPLIER_SHARED);

  private AttachmentVisibility() {}

  public static String normalize(String visibility) {
    String safeVisibility = visibility == null || visibility.isBlank() ? TENANT : visibility;
    if (!SUPPORTED_VISIBILITIES.contains(safeVisibility)) {
      throw new IllegalArgumentException("Unsupported attachment visibility: " + visibility);
    }
    return safeVisibility;
  }
}
