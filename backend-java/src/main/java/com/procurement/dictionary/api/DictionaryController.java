package com.procurement.dictionary.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.dictionary.application.DictionaryApplicationService;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@RequestMapping("/api/v1/dictionaries")
public class DictionaryController {
  private final DictionaryApplicationService dictionaryApplicationService;

  public DictionaryController(DictionaryApplicationService dictionaryApplicationService) {
    this.dictionaryApplicationService = dictionaryApplicationService;
  }

  @GetMapping
  public ApiResponse<List<DictionaryEntryResponse>> list(@RequestParam @NotBlank String type,
      @RequestParam(defaultValue = "false") boolean includeInactive) {
    return ApiResponse.ok(includeInactive ? dictionaryApplicationService.listWithHistory(type)
        : dictionaryApplicationService.listByType(type));
  }
}
