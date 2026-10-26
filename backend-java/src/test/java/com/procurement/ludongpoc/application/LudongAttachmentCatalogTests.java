package com.procurement.ludongpoc.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class LudongAttachmentCatalogTests {
  private final ObjectMapper json = new ObjectMapper();
  private final String base = """
      {"attachmentCategories":[
      {"id":"project_attachment","label":"项目附件","required":false},
      {"id":"mall_confirmation","label":"商城确认材料","required":false},
      {"id":"supplementary_evidence","label":"补充证明","required":false},
      {"id":"custom_1","label":"市场调研报告","required":true}]}
      """;
  @Test void supportsNamedCustomCategoriesAndStableOwnerKeys() throws Exception {
    var values = LudongPocArchiveMaterialCatalog.parse(json.readTree(base));
    assertThat(values).hasSize(4);
    assertThat(values.getLast().ownerType()).isEqualTo("ludong_poc_custom_1");
    assertThat(values.getLast().archiveDirectory()).isEqualTo("05-市场调研报告");
    assertThat(values.getLast().required()).isTrue();
    assertThat(json.writeValueAsString(values.getLast())).contains("\"id\":\"custom_1\"");
  }
  @Test void rejectsUnregisteredKeysAndUnsafeArchiveNames() {
    for (String invalid : new String[]{base.replace("custom_1", "arbitrary"), base.replace("市场调研报告", "../资料"),
        base.replace("custom_1", "project_attachment")}) {
      assertThatThrownBy(()->LudongPocArchiveMaterialCatalog.parse(json.readTree(invalid))).isInstanceOf(IllegalArgumentException.class);
    }
  }
  @Test void keepsLegacyVersionsUnchanged() throws Exception {
    assertThat(LudongPocArchiveMaterialCatalog.parse(json.readTree("{}"))).isEqualTo(LudongPocArchiveMaterialCatalog.CATEGORIES);
  }
}
