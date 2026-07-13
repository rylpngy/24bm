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
    // 输出具体字段错误(取第一条,含 message 注解文案),避免用户只看到无意义的通用提示。
    String detail = exception.getBindingResult().getFieldErrors().stream()
        .findFirst()
        .map(err -> err.getField() + " " + (err.getDefaultMessage() == null ? "不合法" : err.getDefaultMessage()))
        .orElse("请求参数不合法");
    return ApiResponse.fail("参数校验失败:" + detail);
  }
}
