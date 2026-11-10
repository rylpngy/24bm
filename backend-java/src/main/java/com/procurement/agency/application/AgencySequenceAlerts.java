package com.procurement.agency.application;

import com.procurement.identity.application.BuyerDirectoryQuery;
import com.procurement.identity.application.PermissionService;
import com.procurement.notification.application.NotificationApplicationService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Capacity alerts survive the rejected business transaction and are deduplicated by recipient/year.
 */
@Service
public class AgencySequenceAlerts {
  private final BuyerDirectoryQuery directory;
  private final PermissionService permissions;
  private final NotificationApplicationService notifications;

  public AgencySequenceAlerts(
      BuyerDirectoryQuery directory,
      PermissionService permissions,
      NotificationApplicationService notifications) {
    this.directory = directory;
    this.permissions = permissions;
    this.notifications = notifications;
  }

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void warn(String tenant, int year) {
    for (var user : directory.active())
      if (permissions.userHas(user.id(), "buyer:agency:configure"))
        notifications.notifyOnce(
            "agency-sequence-capacity-" + tenant + "-" + year + "-" + user.id(),
            tenant,
            user.id(),
            "代理采购包年度编号容量告警",
            year + "年度编号分配已触及容量预警线或达到9999上限，请核对公司流水并安排有版本记录的扩位方案。系统不会回收旧号或循环取号。");
  }
}
