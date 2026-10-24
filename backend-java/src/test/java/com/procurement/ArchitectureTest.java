package com.procurement;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import com.tngtech.archunit.library.freeze.FreezingArchRule;
import java.util.Set;

/**
 * 架构护栏（标准第三章）：守住模块化单体的分层方向与模块边界。
 *
 * <p>分层规则为硬约束（领域核心必须干净）。模块边界规则用 FreezingArchRule 冻结
 * 现有违规为基线，只拦截新增越界——契合绞杀式重写：存量边界债（如 sourcing 直连
 * supplier 的 Mapper）逐步偿还，但不许再加新的。
 */
@AnalyzeClasses(packages = "com.procurement", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

  /** Flowable 编排层允许使用的跨模块持久化网关；任何新增依赖都必须显式评审后加入。 */
  private static final Set<String> WORKFLOW_ORCHESTRATION_INFRASTRUCTURE = Set.of(
      "com.procurement.approval.infrastructure.ApprovalTemplateMapper",
      "com.procurement.identity.infrastructure.BuyerUserMapper",
      "com.procurement.organization.infrastructure.DepartmentMapper",
      "com.procurement.process.infrastructure.ProcessDefinitionMapper");

  /** 领域核心不依赖控制器层（api 是最外层边缘）。硬约束。 */
  @ArchTest
  static final ArchRule domain_should_not_depend_on_api =
      noClasses()
          .that().resideInAPackage("..domain..")
          .should().dependOnClassesThat().resideInAPackage("..api..");

  /** 领域核心不依赖基础设施实现（持久化细节）。硬约束。 */
  @ArchTest
  static final ArchRule domain_should_not_depend_on_infrastructure =
      noClasses()
          .that().resideInAPackage("..domain..")
          .should().dependOnClassesThat().resideInAPackage("..infrastructure..");

  @ArchTest
  static final ArchRule finance_must_not_use_legacy_approval_runtime =
      noClasses()
          .that().resideInAPackage("com.procurement.finance..")
          .should().dependOnClassesThat().resideInAnyPackage(
              "com.procurement.approval.application..",
              "com.procurement.approval.infrastructure..");

  @ArchTest
  static final ArchRule generic_ai_must_not_depend_on_school_business =
      noClasses().that().resideInAnyPackage("com.procurement.ai..", "com.procurement.common.ai..")
          .should().dependOnClassesThat().resideInAPackage("com.procurement.ludongpoc..");

  @ArchTest
  static final ArchRule shared_ai_contracts_must_remain_business_neutral =
      noClasses().that().resideInAPackage("com.procurement.common.ai..")
          .should().dependOnClassesThat().resideInAnyPackage(
              "com.procurement.ai..", "com.procurement.identity..", "com.procurement.demand..",
              "com.procurement.supplier..", "com.procurement.sourcing..", "com.procurement.attachment..");

  @ArchTest
  static final ArchRule generic_ai_must_not_operate_business_workflows =
      noClasses().that().resideInAPackage("com.procurement.ai..")
          .should().dependOnClassesThat().resideInAnyPackage(
              "com.procurement.workflow.application..", "com.procurement.approval.application..");

  /**
   * 跨模块禁止直接复用别人 api 层的 DTO（同模块用自己的 api DTO 是正常约定，放行）。
   * 冻结现有违规（如 supplier 工作台聚合 order/sourcing 的 Response）。
   */
  @ArchTest
  static final ArchRule api_is_module_private =
      FreezingArchRule.freeze(noClasses().should(accessAnotherModulesPackage("api")));

  /** 每模块独占表：跨模块禁止直接访问别人的 infrastructure。冻结现有违规。 */
  @ArchTest
  static final ArchRule infrastructure_is_module_private =
      FreezingArchRule.freeze(noClasses().should(accessAnotherModulesPackage("infrastructure")));

  /** 跨模块访问另一模块的指定层包（api / infrastructure）即视为越界。 */
  private static ArchCondition<JavaClass> accessAnotherModulesPackage(String layerSegment) {
    return new ArchCondition<>("access another module's " + layerSegment) {
      @Override
      public void check(JavaClass clazz, ConditionEvents events) {
        String ownModule = moduleOf(clazz);
        for (Dependency dependency : clazz.getDirectDependenciesFromSelf()) {
          JavaClass target = dependency.getTargetClass();
          String targetModule = moduleOf(target);
          boolean targetInLayer = target.getPackageName().contains("." + layerSegment);
          if ("api".equals(layerSegment) && "common".equals(targetModule)) {
            // common.api 是跨模块稳定契约（统一信封和通用审批回执），不属于任一业务模块私有 API。
            continue;
          }
          if ("infrastructure".equals(layerSegment)
              && "workflow".equals(ownModule)
              && WORKFLOW_ORCHESTRATION_INFRASTRUCTURE.contains(target.getFullName())) {
            // workflow 是唯一 Flowable 运行时编排模块；白名单之外的跨模块 Mapper 仍受护栏拦截。
            continue;
          }
          if (targetInLayer
              && !targetModule.isEmpty()
              && !targetModule.equals(ownModule)) {
            // noClasses().should(...) 语义：匹配到坏依赖发 satisfied，由 noClasses 翻转为违规。
            events.add(SimpleConditionEvent.satisfied(dependency, dependency.getDescription()));
          }
        }
      }
    };
  }

  /** 取 com.procurement.{module} 的 module 段。 */
  private static String moduleOf(JavaClass clazz) {
    String prefix = "com.procurement.";
    String pkg = clazz.getPackageName();
    if (!pkg.startsWith(prefix)) {
      return "";
    }
    String rest = pkg.substring(prefix.length());
    int dot = rest.indexOf('.');
    return dot < 0 ? rest : rest.substring(0, dot);
  }
}
