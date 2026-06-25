package com.procurement.common.api;

import com.procurement.common.tenant.PermissionDeniedException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

  @ExceptionHandler(PermissionDeniedException.class)
  @ResponseStatus(HttpStatus.FORBIDDEN)
  public ApiResponse<Void> handlePermissionDenied(PermissionDeniedException exception) {
    return ApiResponse.fail(exception.getMessage());
  }

  @ExceptionHandler(IllegalArgumentException.class)
  @ResponseStatus(HttpStatus.BAD_REQUEST)
  public ApiResponse<Void> handleIllegalArgument(IllegalArgumentException exception) {
    return ApiResponse.fail(exception.getMessage());
  }

  @ExceptionHandler(IllegalStateException.class)
  @ResponseStatus(HttpStatus.BAD_REQUEST)
  public ApiResponse<Void> handleIllegalState(IllegalStateException exception) {
    return ApiResponse.fail(exception.getMessage());
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  @ResponseStatus(HttpStatus.BAD_REQUEST)
  public ApiResponse<Void> handleValidation(MethodArgumentNotValidException exception) {
    return ApiResponse.fail("Invalid request payload");
  }
}
