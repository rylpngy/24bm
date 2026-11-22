package com.procurement.agency.api;
import com.procurement.agency.application.*;
import com.procurement.agency.domain.AgencyWorkbenchRecords.*;
import com.procurement.agency.domain.AgencyExecutionRecords.TemplateView;
import com.procurement.common.api.ApiResponse;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/agency/workbench")
public record AgencyWorkbenchController(AgencyWorkbenchService service,AgencyTemplateService templates) {
  @GetMapping("/calendar")
  public ApiResponse<List<CalendarEvent>> calendar(@RequestParam String month) { return ApiResponse.ok(service.calendar(month)); }
  @GetMapping("/documents")
  public ApiResponse<DocumentPage> documents(@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="15") int pageSize,@RequestParam(defaultValue="") String keyword,@RequestParam(defaultValue="") String kind) { return ApiResponse.ok(service.documents(page,pageSize,keyword,kind)); }
  @GetMapping("/templates")
  public ApiResponse<List<TemplateView>> templates(@RequestParam(defaultValue="") String method,@RequestParam(defaultValue="") String keyword) { return ApiResponse.ok(templates.library(method,keyword)); }
}
