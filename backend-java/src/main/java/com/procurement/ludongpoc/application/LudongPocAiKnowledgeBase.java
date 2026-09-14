package com.procurement.ludongpoc.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.ludongpoc.api.LudongPocAiEvidenceReference;
import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

@Component
public class LudongPocAiKnowledgeBase {
  private static final String RESOURCE = "ludong-poc/knowledge/approval-policy-v1.json";

  private final String version;
  private final String institutionalBasis;
  private final String evidenceBoundary;
  private final List<String> institutionalDocuments;
  private final Map<String, PolicyRule> rules;

  public LudongPocAiKnowledgeBase(ObjectMapper objectMapper) {
    try (InputStream input = new ClassPathResource(RESOURCE).getInputStream()) {
      PolicyDocument document = objectMapper.readValue(input, PolicyDocument.class);
      this.version = document.version();
      this.institutionalBasis = document.institutionalBasis();
      this.evidenceBoundary = document.evidenceBoundary();
      this.institutionalDocuments = List.copyOf(document.institutionalDocuments());
      Map<String, PolicyRule> indexed = new LinkedHashMap<>();
      document.rules().forEach(rule -> indexed.put(rule.id(), rule));
      this.rules = Map.copyOf(indexed);
    } catch (Exception exception) {
      throw new IllegalStateException("无法加载鲁东大学采购制度知识库: " + RESOURCE, exception);
    }
  }

  public String version() {
    return version;
  }

  public String institutionalBasis() {
    return institutionalBasis;
  }

  public String evidenceBoundary() {
    return evidenceBoundary;
  }

  public List<String> institutionalDocuments() {
    return institutionalDocuments;
  }

  public LudongPocAiEvidenceReference reference(String ruleId) {
    PolicyRule rule = rules.get(ruleId);
    if (rule == null) {
      throw new IllegalArgumentException("未知采购制度条款: " + ruleId);
    }
    return new LudongPocAiEvidenceReference(
        "rule:" + rule.id(), "RULE", rule.title(), rule.clause(), rule.source(),
        rule.verificationStatus());
  }

  public List<LudongPocAiEvidenceReference> references(String... ruleIds) {
    return List.of(ruleIds).stream().map(this::reference).toList();
  }

  private record PolicyDocument(
      String version,
      String institutionalBasis,
      String evidenceBoundary,
      List<String> institutionalDocuments,
      List<PolicyRule> rules) {
  }

  private record PolicyRule(
      String id,
      String title,
      String clause,
      String source,
      String verificationStatus) {
  }
}
