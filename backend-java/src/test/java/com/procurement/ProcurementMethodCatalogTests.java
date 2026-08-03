package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.tenant.domain.ProcurementMethodCatalog;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** M-0 采购方式能力矩阵:开关解析、向后兼容与模块映射。 */
class ProcurementMethodCatalogTests {

  @Test
  @DisplayName("未做方式配置的存量租户全部方式放行(改造不减少既有能力)")
  void legacyTenantKeepsEveryMethod() {
    List<String> legacy = List.of("rfq", "order", "finance", "contract", "mall");

    assertThat(ProcurementMethodCatalog.enabledMethods(legacy))
        .containsExactlyElementsOf(ProcurementMethodCatalog.all());
    assertThat(ProcurementMethodCatalog.isMethodEnabled(legacy, "招标")).isTrue();
    assertThat(ProcurementMethodCatalog.enabledMethods(List.of())).hasSize(5);
    assertThat(ProcurementMethodCatalog.enabledMethods(null)).hasSize(5);
  }

  @Test
  @DisplayName("出现任一 method:* 键即按清单精确判定")
  void configuredTenantOnlyGetsListedMethods() {
    List<String> mallOnly = List.of("order", "finance", "method:mall");

    assertThat(ProcurementMethodCatalog.enabledMethods(mallOnly))
        .containsExactly(ProcurementMethodCatalog.MALL);
    assertThat(ProcurementMethodCatalog.isMethodEnabled(mallOnly, "商城")).isTrue();
    assertThat(ProcurementMethodCatalog.isMethodEnabled(mallOnly, "询比")).isFalse();
    assertThat(ProcurementMethodCatalog.isMethodEnabled(mallOnly, "招标")).isFalse();
  }

  @Test
  @DisplayName("老的模块级 mall 键在精细配置下仍等价于商城方式")
  void legacyMallKeyStillGrantsMall() {
    List<String> mixed = List.of("mall", "method:compare");

    assertThat(ProcurementMethodCatalog.enabledMethods(mixed))
        .containsExactly(ProcurementMethodCatalog.COMPARE, ProcurementMethodCatalog.MALL);
  }

  @Test
  @DisplayName("方式映射到工作台模块;单一来源不额外占模块,招标不进创建向导")
  void moduleAndWizardMapping() {
    assertThat(ProcurementMethodCatalog.methodModuleIds(List.of("method:mall")))
        .containsExactly("mall");
    assertThat(ProcurementMethodCatalog.methodModuleIds(List.of("method:single-source")))
        .isEmpty();
    assertThat(ProcurementMethodCatalog.allMethodModuleIds())
        .containsExactlyInAnyOrder("rfqs", "auctions", "mall", "tenders");
    assertThat(ProcurementMethodCatalog.TENDER.inCreateWizard()).isFalse();
    assertThat(ProcurementMethodCatalog.COMPARE.inCreateWizard()).isTrue();
  }

  @Test
  @DisplayName("方式码与寻源/招标口径一致,可按码回查定义")
  void codesMatchBusinessVocabulary() {
    assertThat(ProcurementMethodCatalog.byCode("询比")).isEqualTo(ProcurementMethodCatalog.COMPARE);
    assertThat(ProcurementMethodCatalog.byCode("竞价")).isEqualTo(ProcurementMethodCatalog.AUCTION);
    assertThat(ProcurementMethodCatalog.byCode("商城")).isEqualTo(ProcurementMethodCatalog.MALL);
    assertThat(ProcurementMethodCatalog.byCode("单一来源"))
        .isEqualTo(ProcurementMethodCatalog.SINGLE_SOURCE);
    assertThat(ProcurementMethodCatalog.byCode("招标")).isEqualTo(ProcurementMethodCatalog.TENDER);
    assertThat(ProcurementMethodCatalog.byCode("不存在的方式")).isNull();
  }
}
