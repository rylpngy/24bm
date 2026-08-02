package com.procurement.dictionary.application;

import com.procurement.dictionary.api.DictionaryAdminEntryResponse;
import com.procurement.dictionary.api.DictionaryEntryResponse;
import com.procurement.dictionary.api.DictionaryTypeSummaryResponse;
import com.procurement.dictionary.api.SaveDictionaryEntryRequest;
import com.procurement.dictionary.domain.DictionaryEntry;
import com.procurement.dictionary.domain.DictionaryPolicy;
import com.procurement.dictionary.infrastructure.DictionaryMapper;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

  // ── 平台运营维护(D-4) ───────────────────────────────────
  public List<DictionaryTypeSummaryResponse> listTypeSummaries() {
    return dictionaryMapper.listTypeSummaries().stream()
        .map(s -> new DictionaryTypeSummaryResponse(s.type(), s.entryCount(), s.activeCount()))
        .toList();
  }

  public List<DictionaryAdminEntryResponse> listAllByType(String type) {
    return dictionaryMapper.listAllByType(type).stream()
        .map(e -> new DictionaryAdminEntryResponse(
            e.type(), e.code(), e.label(), e.sortOrder(), e.status()))
        .toList();
  }

  /** 新增字典条目:type/code 校验并去重,状态默认启用。 */
  @Transactional
  public DictionaryAdminEntryResponse create(SaveDictionaryEntryRequest request) {
    String type = request.type().trim();
    String code = request.code().trim();
    DictionaryPolicy.requireValidKey(type, "字典类型");
    DictionaryPolicy.requireValidKey(code, "条目编码");
    DictionaryPolicy.requireValidLabel(request.label());
    String status = DictionaryPolicy.normalizeStatus(request.status());
    DictionaryPolicy.requireAbsent(dictionaryMapper.find(type, code), type, code);
    int sortOrder = request.sortOrder() == null ? 0 : request.sortOrder();
    dictionaryMapper.insert(type, code, request.label().trim(), sortOrder, status);
    return new DictionaryAdminEntryResponse(type, code, request.label().trim(), sortOrder, status);
  }

  /** 维护条目:type/code 为主键不可改,仅名称/排序/状态可更新(引用安全)。 */
  @Transactional
  public DictionaryAdminEntryResponse update(String type, String code, SaveDictionaryEntryRequest request) {
    DictionaryEntry existing = dictionaryMapper.find(type, code);
    DictionaryPolicy.requirePresent(existing, type, code);
    DictionaryPolicy.requireValidLabel(request.label());
    String status = DictionaryPolicy.normalizeStatus(request.status());
    int sortOrder = request.sortOrder() == null ? existing.sortOrder() : request.sortOrder();
    dictionaryMapper.update(type, code, request.label().trim(), sortOrder, status);
    return new DictionaryAdminEntryResponse(type, code, request.label().trim(), sortOrder, status);
  }

  private DictionaryEntryResponse toResponse(DictionaryEntry entry) {
    return new DictionaryEntryResponse(
        entry.type(),
        entry.code(),
        entry.label(),
        entry.sortOrder());
  }
}
