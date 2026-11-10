package com.procurement.agency;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.procurement.agency.application.*;
import com.procurement.agency.domain.AgencyRecords.*;
import com.procurement.agency.infrastructure.AgencyMapper;
import java.util.List;
import org.junit.jupiter.api.Test;

class AgencyFileManifestTests {
  @Test
  void freezesOnlyLatestSealedVersionAndDoesNotDiscloseRestrictedName() {
    var mapper = mock(AgencyMapper.class);
    var guard = mock(AgencyGuard.class);
    when(guard.tenant()).thenReturn("t");
    when(mapper.files("t", "p"))
        .thenReturn(
            List.of(
                new FileRow(
                    "f", "t", "p", "Confidential name", "entrustment", "restricted", "u", null)));
    when(mapper.versions("t", "f"))
        .thenReturn(
            List.of(
                new FileVersion("v3", "t", "f", 3, "cancelled", null, null, null, "u", null, null),
                new FileVersion("v2", "t", "f", 2, "sealed", "a2", "hash2", 10L, "u", null, null),
                new FileVersion("v1", "t", "f", 1, "sealed", "a1", "hash1", 9L, "u", null, null)));
    var service = new AgencyFiles(mapper, guard, null, null, null, null, null, null);
    var snapshot = service.frozenManifest("p");
    assertThat(snapshot).hasSize(1);
    assertThat(snapshot.getFirst())
        .containsEntry("versionId", "v2")
        .containsEntry("sha256", "hash2");
    assertThat(snapshot.toString()).doesNotContain("Confidential name");
  }
}
