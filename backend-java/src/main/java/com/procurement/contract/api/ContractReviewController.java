package com.procurement.contract.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.contract.api.ContractReviewContracts.*;
import com.procurement.contract.application.*;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/contract-review")
public record ContractReviewController(ContractReviewRulesService rules,ContractReviewService service){
  @GetMapping("/rule-sets") public ApiResponse<List<RuleSet>> ruleSets(){return ApiResponse.ok(rules.sets());}
  @PostMapping("/rule-sets") public ApiResponse<RuleSet> create(@Valid @RequestBody SaveRules request){return ApiResponse.ok(rules.save(null,request));}
  @PutMapping("/rule-sets/{id}") public ApiResponse<RuleSet> save(@PathVariable String id,@Valid @RequestBody SaveRules request){return ApiResponse.ok(rules.save(id,request));}
  @PostMapping("/rule-sets/{id}/publish") public ApiResponse<RuleVersion> publish(@PathVariable String id,@Valid @RequestBody Publish request){return ApiResponse.ok(rules.publish(id,request.expectedRevision()));}
  @GetMapping("/rule-versions") public ApiResponse<List<RuleVersion>> versions(){return ApiResponse.ok(rules.versions());}
  @GetMapping("/documents") public ApiResponse<Page<Document>> documents(@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="10")int pageSize){return ApiResponse.ok(service.documents(page,pageSize));}
  @PostMapping(value="/documents",consumes=MediaType.APPLICATION_OCTET_STREAM_VALUE)
  public ApiResponse<Document> upload(@RequestParam String fileName,@RequestBody byte[] bytes){return ApiResponse.ok(service.upload(fileName,bytes));}
  @GetMapping("/documents/{id}") public ApiResponse<Workspace> document(@PathVariable String id){return ApiResponse.ok(service.workspace(id));}
  @PostMapping("/documents/{id}/reviews") public ApiResponse<Run> review(@PathVariable String id,@Valid @RequestBody Start request){return ApiResponse.ok(service.review(id,request));}
  @PostMapping("/documents/{id}/reviews/{run}/decisions") public ApiResponse<Decision> decide(@PathVariable String id,@PathVariable String run,@Valid @RequestBody Decide request){return ApiResponse.ok(service.decide(id,run,request));}
  @GetMapping("/documents/{id}/original") public ResponseEntity<byte[]> original(@PathVariable String id){return file(service.original(id));}
  @GetMapping("/documents/{id}/versions/{version}/export") public ResponseEntity<byte[]> export(@PathVariable String id,@PathVariable int version){return file(service.export(id,version));}
  private ResponseEntity<byte[]> file(ContractReviewService.Download value){return ResponseEntity.ok().contentType(MediaType.APPLICATION_OCTET_STREAM)
      .header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename*=UTF-8''"+java.net.URLEncoder.encode(value.name(),java.nio.charset.StandardCharsets.UTF_8).replace("+","%20")).body(value.bytes());}
}
