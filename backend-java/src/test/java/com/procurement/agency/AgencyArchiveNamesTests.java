package com.procurement.agency;

import static org.assertj.core.api.Assertions.*;

import com.procurement.agency.application.AgencyArchiveNames;
import java.util.*;
import org.junit.jupiter.api.Test;

class AgencyArchiveNamesTests {
  @Test
  void neutralizesTraversalAndControlCharacters() {
    assertThat(AgencyArchiveNames.safe("../../folder\\secret\u0000.txt"))
        .doesNotContain("..", "/", "\\", "\u0000");
  }

  @Test
  void normalizedCaseInsensitiveDuplicatesCannotOverwrite() {
    Set<String> names = new HashSet<>();
    var a = AgencyArchiveNames.unique("é.DOCX", names);
    var b = AgencyArchiveNames.unique("e\u0301.docx", names);
    assertThat(a).isNotEqualToIgnoringCase(b);
  }

  @Test
  void handlesEmptyReservedAndLongNames() {
    assertThat(AgencyArchiveNames.safe("...")).isNotBlank();
    assertThat(AgencyArchiveNames.safe("CON.txt")).startsWith("_");
    assertThat(AgencyArchiveNames.safe("中".repeat(300))).hasSizeLessThanOrEqualTo(150);
  }
}
