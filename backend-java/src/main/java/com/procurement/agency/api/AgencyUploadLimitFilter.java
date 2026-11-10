package com.procurement.agency.api;

import com.procurement.agency.application.AgencyFileSafety;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Limit raw agency uploads before Spring buffers @RequestBody byte arrays. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 30)
public class AgencyUploadLimitFilter extends OncePerRequestFilter {
  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    if (!"/api/v1/buyer/attachments/upload-sink".equals(request.getRequestURI())) {
      chain.doFilter(request, response);
      return;
    }
    String key = request.getParameter("storageKey");
    if (key == null || !key.contains("/agency_file_version/")) {
      chain.doFilter(request, response);
      return;
    }
    if (request.getContentLengthLong() > AgencyFileSafety.MAX_BYTES) {
      response.setStatus(413);
      response.setContentType("application/json;charset=UTF-8");
      response.getWriter().write("{\"success\":false,\"message\":\"附件不得超过10MB\"}");
      return;
    }
    chain.doFilter(
        new HttpServletRequestWrapper(request) {
          @Override
          public ServletInputStream getInputStream() throws IOException {
            ServletInputStream source = super.getInputStream();
            return new ServletInputStream() {
              long size = 0;

              void count(int n) throws IOException {
                if (n > 0 && (size += n) > AgencyFileSafety.MAX_BYTES)
                  throw new IOException("附件不得超过10MB");
              }

              public int read() throws IOException {
                int b = source.read();
                count(b < 0 ? 0 : 1);
                return b;
              }

              public int read(byte[] data, int offset, int len) throws IOException {
                int n = source.read(data, offset, Math.min(len, AgencyFileSafety.MAX_BYTES + 1));
                count(n);
                return n;
              }

              public boolean isFinished() {
                return source.isFinished();
              }

              public boolean isReady() {
                return source.isReady();
              }

              public void setReadListener(ReadListener listener) {
                source.setReadListener(listener);
              }
            };
          }
        },
        response);
  }
}
