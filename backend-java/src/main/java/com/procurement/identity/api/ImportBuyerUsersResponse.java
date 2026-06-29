package com.procurement.identity.api;

import java.util.List;

// 批量导入结果:成功数 + 失败数 + 失败明细(行号从 1 起)。
public record ImportBuyerUsersResponse(
    int created,
    int failed,
    List<Failure> failures) {

  public record Failure(int row, String name, String reason) {}
}
