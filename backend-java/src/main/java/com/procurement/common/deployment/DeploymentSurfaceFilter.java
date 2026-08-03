package com.procurement.common.deployment;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * 部署形态裁剪(M-5):商城版只对外暴露商城直采所需的接口面。
 *
 * <p>{@code app.deployment.profile=mall} 时,寻源(询比/竞价)与招标相关路径一律 404
 * ——同一份代码、同一个镜像,按形态售卖与部署,不分叉出第二套代码库。
 *
 * <p><b>裁剪的是 HTTP 接口面,不是 Bean 装配</b>:相关 Bean 仍在容器里(商城下单内部
 * 仍要调用 sourcing 的锚点 RFQ 服务),内存占用与 full 形态一致。对外能力边界以本清单为准。
 *
 * <p><b>维护约定</b>:新增寻源/招标类控制器时必须同步 {@link #NON_MALL_PREFIXES};
 * 契约测试 DeploymentSurfaceTests 会校验清单内路径在 mall 形态下确已关闭,
 * 但无法自动发现「新加了却没登记」的路径——加控制器时请一并检查。
 */
@Component
public class DeploymentSurfaceFilter extends OncePerRequestFilter {

  public static final String PROFILE_MALL = "mall";
  public static final String PROFILE_FULL = "full";

  /** 商城形态下关闭的路径前缀:寻源(询比/竞价)、招标、公开商机与采购公告。 */
  static final List<String> NON_MALL_PREFIXES = List.of(
      "/api/v1/buyer/rfqs",
      "/api/v1/buyer/tenders",
      "/api/v1/buyer/auction-stream",
      "/api/v1/supplier/rfqs",
      "/api/v1/supplier/tenders",
      "/api/v1/supplier/quotes",
      "/api/v1/supplier/auction-stream",
      "/api/v1/public/opportunities",
      "/api/v1/public/procurement-announcements");

  private final String profile;

  public DeploymentSurfaceFilter(
      @Value("${app.deployment.profile:full}") String profile) {
    this.profile = profile == null || profile.isBlank() ? PROFILE_FULL : profile.trim();
  }

  public boolean isMallOnly() {
    return PROFILE_MALL.equalsIgnoreCase(profile);
  }

  static boolean isNonMallPath(String path) {
    return NON_MALL_PREFIXES.stream().anyMatch(path::startsWith);
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    if (isMallOnly() && isNonMallPath(request.getRequestURI())) {
      response.setStatus(HttpServletResponse.SC_NOT_FOUND);
      response.setContentType("application/json;charset=UTF-8");
      response.getWriter().write(
          "{\"success\":false,\"data\":null,"
          + "\"message\":\"本部署为商城直采版,未开放该功能接口。\"}");
      return;
    }
    chain.doFilter(request, response);
  }
}
