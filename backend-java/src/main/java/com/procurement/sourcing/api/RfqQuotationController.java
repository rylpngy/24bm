package com.procurement.sourcing.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.sourcing.application.*;
import com.procurement.sourcing.infrastructure.QuotationMapper;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;

@RestController
public record RfqQuotationController(RfqQuotationService service,QuotationComparisonExport export) {
  @GetMapping("/api/v1/buyer/rfqs/{id}/quotation-package")
  public ApiResponse<RfqQuotationService.Package> buyer(@PathVariable String id){return ApiResponse.ok(service.read(id,false));}
  @GetMapping("/api/v1/supplier/rfqs/{id}/quotation-package")
  public ApiResponse<RfqQuotationService.Package> supplier(@PathVariable String id){return ApiResponse.ok(service.read(id,true));}
  @PutMapping("/api/v1/buyer/rfqs/{id}/quotation-policy")
  public ApiResponse<QuotationMapper.Policy> configure(@PathVariable String id,@RequestBody RfqQuotationService.PolicyRequest request){return ApiResponse.ok(service.configure(id,request));}
  @PostMapping("/api/v1/buyer/rfqs/{id}/extend-quotation")
  public ApiResponse<QuotationMapper.Extension> extend(@PathVariable String id,@RequestBody RfqQuotationService.ExtendRequest request){return ApiResponse.ok(service.extend(id,request));}
  @PostMapping(value="/api/v1/supplier/rfqs/{id}/quotation-files",consumes=MediaType.APPLICATION_OCTET_STREAM_VALUE)
  public ApiResponse<RfqQuotationService.FileView> upload(@PathVariable String id,@RequestParam String fileName,@RequestBody byte[] bytes){return ApiResponse.ok(service.upload(id,fileName,bytes));}
  @GetMapping("/api/v1/buyer/rfqs/{id}/quotation-files/{file}")
  public ResponseEntity<byte[]> buyerFile(@PathVariable String id,@PathVariable String file){return download(service.download(id,file,false));}
  @GetMapping("/api/v1/supplier/rfqs/{id}/quotation-files/{file}")
  public ResponseEntity<byte[]> supplierFile(@PathVariable String id,@PathVariable String file){return download(service.download(id,file,true));}
  @GetMapping("/api/v1/buyer/rfqs/{id}/technical-comparison.xlsx")
  public ResponseEntity<byte[]> comparison(@PathVariable String id){return ResponseEntity.ok().contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
      .header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=technical-comparison.xlsx").body(export.export(id));}
  private ResponseEntity<byte[]> download(RfqQuotationService.Download file){return ResponseEntity.ok().contentType(MediaType.APPLICATION_OCTET_STREAM)
      .header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename*=UTF-8''"+java.net.URLEncoder.encode(file.fileName(),java.nio.charset.StandardCharsets.UTF_8).replace("+","%20")).body(file.data());}
}
