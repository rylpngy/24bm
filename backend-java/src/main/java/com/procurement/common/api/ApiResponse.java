package com.procurement.common.api;

public record ApiResponse<T>(boolean success, T data, String message) {

  public static <T> ApiResponse<T> ok(T data) {
    return new ApiResponse<>(true, data, "");
  }

  public static <T> ApiResponse<T> fail(String message) {
    return new ApiResponse<>(false, null, message);
  }
}
