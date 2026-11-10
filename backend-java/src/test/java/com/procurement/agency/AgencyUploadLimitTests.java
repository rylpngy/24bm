package com.procurement.agency;

import static org.assertj.core.api.Assertions.*;

import com.procurement.agency.api.AgencyUploadLimitFilter;
import com.procurement.agency.application.AgencyFileSafety;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.*;

class AgencyUploadLimitTests {
  @Test
  void rejectsOversizedAgencyBodyBeforeBuffering() throws Exception {
    var request = new MockHttpServletRequest("POST", "/api/v1/buyer/attachments/upload-sink");
    request.setParameter("storageKey", "tenant/agency_file_version/version/file.txt");
    request.setContent(new byte[AgencyFileSafety.MAX_BYTES + 1]);
    var response = new MockHttpServletResponse();
    new AgencyUploadLimitFilter()
        .doFilter(
            request,
            response,
            (req, res) -> {
              throw new AssertionError("controller should not receive oversized body");
            });
    assertThat(response.getStatus()).isEqualTo(413);
  }

  @Test
  void preservesOtherAttachmentOwners() throws Exception {
    var request = new MockHttpServletRequest("POST", "/api/v1/buyer/attachments/upload-sink");
    request.setParameter("storageKey", "tenant/contract/id/file.txt");
    request.setContent(new byte[3]);
    var response = new MockHttpServletResponse();
    var called = new boolean[1];
    new AgencyUploadLimitFilter().doFilter(request, response, (req, res) -> called[0] = true);
    assertThat(called[0]).isTrue();
  }
}
