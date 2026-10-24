package com.procurement.ai.api;

import com.procurement.ai.application.AiConflictException;
import com.procurement.common.api.ApiResponse;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;

@RestControllerAdvice(assignableTypes=AiReviewController.class)
public class AiExceptionHandler {
  @ExceptionHandler(AiConflictException.class) @ResponseStatus(HttpStatus.CONFLICT)
  public ApiResponse<Void> conflict(AiConflictException exception) { return ApiResponse.fail(exception.getMessage()); }
}
