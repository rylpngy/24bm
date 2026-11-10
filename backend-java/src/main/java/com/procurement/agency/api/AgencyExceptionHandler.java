package com.procurement.agency.api;

import com.procurement.agency.domain.AgencyConflictException;
import com.procurement.common.api.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
public class AgencyExceptionHandler {
  @ExceptionHandler(AgencyConflictException.class)
  @ResponseStatus(HttpStatus.CONFLICT)
  public ApiResponse<Void> conflict(AgencyConflictException e) {
    return ApiResponse.fail(e.getMessage());
  }
}
