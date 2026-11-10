package com.procurement.agency.domain;

public class AgencyConflictException extends RuntimeException {
  public AgencyConflictException(String message) {
    super(message);
  }
}
