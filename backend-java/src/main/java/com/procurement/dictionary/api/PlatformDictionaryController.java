package com.procurement.dictionary.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.dictionary.application.DictionaryApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 平台运营配置:全局字典维护(仅平台角色可访问,路径在安全配置中受 /platform/** 保护)。 */
@RestController
@RequestMapping("/api/v1/platform/dictionaries")
public class PlatformDictionaryController {
  private final DictionaryApplicationService dictionaryApplicationService;

  public PlatformDictionaryController(DictionaryApplicationService dictionaryApplicationService) {
    this.dictionaryApplicationService = dictionaryApplicationService;
  }

  @GetMapping
  public ApiResponse<List<DictionaryTypeSummaryResponse>> types() {
    return ApiResponse.ok(dictionaryApplicationService.listTypeSummaries());
  }

  @GetMapping("/{type}/entries")
  public ApiResponse<List<DictionaryAdminEntryResponse>> entries(@PathVariable String type) {
    return ApiResponse.ok(dictionaryApplicationService.listAllByType(type));
  }

  @PostMapping("/entries")
  public ApiResponse<DictionaryAdminEntryResponse> create(
      @Valid @RequestBody SaveDictionaryEntryRequest request) {
    return ApiResponse.ok(dictionaryApplicationService.create(request));
  }

  @PutMapping("/{type}/entries/{code}")
  public ApiResponse<DictionaryAdminEntryResponse> update(
      @PathVariable String type,
      @PathVariable String code,
      @Valid @RequestBody SaveDictionaryEntryRequest request) {
    return ApiResponse.ok(dictionaryApplicationService.update(type, code, request));
  }
}
