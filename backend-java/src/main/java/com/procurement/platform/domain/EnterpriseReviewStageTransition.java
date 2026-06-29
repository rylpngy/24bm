package com.procurement.platform.domain;

import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

// 企业准入审核状态机:校验并解析「当前阶段 + 动作」→ 目标阶段。非法流转抛异常。
// 动作:preliminary_pass(初审通过)/approve(准入通过)/reject(驳回)/return(退回补充)/reopen(重新受理)。
// reject 与 return 必须填写意见(理由)。
@Component
public class EnterpriseReviewStageTransition {

  public record Rule(String fromStage, String toStage, boolean requiresComment) {}

  private static final Map<String, Rule> RULES = Map.of(
      "preliminary_pass",
      new Rule(EnterpriseReviewStage.PENDING, EnterpriseReviewStage.PRELIMINARY, false),
      "approve",
      new Rule(EnterpriseReviewStage.PRELIMINARY, EnterpriseReviewStage.APPROVED, false),
      "reject",
      new Rule(null, EnterpriseReviewStage.REJECTED, true),
      "return",
      new Rule(EnterpriseReviewStage.PRELIMINARY, EnterpriseReviewStage.PENDING, true),
      "reopen",
      new Rule(EnterpriseReviewStage.REJECTED, EnterpriseReviewStage.PENDING, false));

  // reject 可从 pending 或 preliminary 触发(两个阶段都允许驳回)。
  private static final List<String> REJECTABLE_FROM =
      List.of(EnterpriseReviewStage.PENDING, EnterpriseReviewStage.PRELIMINARY);

  public Rule resolve(String currentStage, String action) {
    Rule rule = RULES.get(action);
    if (rule == null) {
      throw new IllegalArgumentException("非法审核动作: " + action);
    }
    boolean validFrom =
        "reject".equals(action) ? REJECTABLE_FROM.contains(currentStage)
            : rule.fromStage().equals(currentStage);
    if (!validFrom) {
      throw new IllegalArgumentException(
          "当前阶段「" + EnterpriseReviewStage.label(currentStage) + "」不允许执行该动作: " + action);
    }
    return rule;
  }
}
