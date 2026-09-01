package com.procurement.ludongpoc.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.ludongpoc.api.LudongPocApplicationResponse;
import java.io.InputStream;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

@Service
public class LudongPocAiEvaluationService {
  private static final String RESOURCE = "ludong-poc/knowledge/ai-evaluation-samples-v1.json";
  private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};
  private static final TypeReference<List<Map<String, Object>>> ITEMS_TYPE = new TypeReference<>() {};

  private final String version;
  private final List<EvaluationSample> samples;
  private final LudongPocAiReviewService reviewService;

  public LudongPocAiEvaluationService(
      ObjectMapper objectMapper, LudongPocAiReviewService reviewService) {
    this.reviewService = reviewService;
    try (InputStream input = new ClassPathResource(RESOURCE).getInputStream()) {
      JsonNode root = objectMapper.readTree(input);
      this.version = root.path("version").asText();
      List<EvaluationSample> loaded = new ArrayList<>();
      root.path("samples").forEach(sample -> loaded.add(new EvaluationSample(
          sample.path("id").asText(),
          sample.path("nodeId").asText(),
          sample.path("budgetAmount").decimalValue(),
          objectMapper.convertValue(sample.path("formData"), MAP_TYPE),
          objectMapper.convertValue(sample.path("items"), ITEMS_TYPE),
          objectMapper.convertValue(sample.path("expectedRiskTitles"), new TypeReference<>() {}))));
      this.samples = List.copyOf(loaded);
    } catch (Exception exception) {
      throw new IllegalStateException("无法加载 AI 固定评测样本: " + RESOURCE, exception);
    }
  }

  public EvaluationResult evaluate() {
    int expected = 0;
    int detected = 0;
    int truePositive = 0;
    int falsePositive = 0;
    OffsetDateTime now = OffsetDateTime.parse("2026-08-31T10:00:00+08:00");
    for (EvaluationSample sample : samples) {
      LudongPocApplicationResponse application = new LudongPocApplicationResponse(
          "eval-" + sample.id(), "EVAL-" + sample.id(), "固定评测项目-" + sample.id(),
          "评测申报单位", "eval-department", sample.budgetAmount(), "in_approval",
          sample.formData(), sample.items(), "evaluator", now, null, null, now, now);
      List<String> detectedTitles = reviewService.reviewRulesOnly(
              application, sample.nodeId(), Map.of(), List.of()).findings().stream()
          .filter(finding -> "risk".equals(finding.level()))
          .map(finding -> finding.title())
          .toList();
      expected += sample.expectedRiskTitles().size();
      detected += detectedTitles.size();
      truePositive += (int) sample.expectedRiskTitles().stream().filter(detectedTitles::contains).count();
      falsePositive += (int) detectedTitles.stream()
          .filter(title -> !sample.expectedRiskTitles().contains(title)).count();
    }
    return new EvaluationResult(
        version, samples.size(), expected, detected, truePositive, falsePositive,
        ratio(truePositive, expected), ratio(truePositive, truePositive + falsePositive));
  }

  private static double ratio(int numerator, int denominator) {
    return denominator == 0 ? 1.0 : Math.round(numerator * 10000.0 / denominator) / 10000.0;
  }

  public record EvaluationResult(
      String datasetVersion,
      int sampleCount,
      int expectedRiskCount,
      int detectedRiskCount,
      int truePositiveCount,
      int falsePositiveCount,
      double riskRecall,
      double riskPrecision) {
  }

  private record EvaluationSample(
      String id,
      String nodeId,
      BigDecimal budgetAmount,
      Map<String, Object> formData,
      List<Map<String, Object>> items,
      List<String> expectedRiskTitles) {
  }
}
