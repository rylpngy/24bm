package com.procurement.dictionary.application;

import com.procurement.dictionary.api.DictionaryEntryResponse;
import com.procurement.dictionary.domain.DictionaryEntry;
import com.procurement.dictionary.infrastructure.DictionaryMapper;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class DictionaryApplicationService {
  private final DictionaryMapper dictionaryMapper;

  public DictionaryApplicationService(DictionaryMapper dictionaryMapper) {
    this.dictionaryMapper = dictionaryMapper;
  }

  public List<DictionaryEntryResponse> listByType(String type) {
    return dictionaryMapper.listActiveByType(type).stream()
        .map(this::toResponse)
        .toList();
  }

  private DictionaryEntryResponse toResponse(DictionaryEntry entry) {
    return new DictionaryEntryResponse(
        entry.type(),
        entry.code(),
        entry.label(),
        entry.sortOrder());
  }
}
