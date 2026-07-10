package com.procurement.mall.domain;

public final class MallListingStatus {
  public static final String ON_SHELF = "在架";
  public static final String OFF_SHELF = "下架";

  private MallListingStatus() {
  }

  public static boolean isValid(String status) {
    return ON_SHELF.equals(status) || OFF_SHELF.equals(status);
  }
}
