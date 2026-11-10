package com.procurement.agency;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.agency.application.*;
import com.procurement.agency.domain.AgencyExecutionRecords.*;
import com.procurement.agency.domain.AgencyRecords.PackageRow;
import com.procurement.agency.infrastructure.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class AgencyReminderDispatchTests {
  private final AgencyJson json = new AgencyJson(new ObjectMapper().findAndRegisterModules());

  private PackageRow pkg() {
    return json.read(
        "{\"id\":\"p\",\"tenantId\":\"t\",\"status\":\"approved\",\"createdBy\":\"u\"}",
        PackageRow.class);
  }

  private ReminderDelivery delivery(long node, long policy) {
    return new ReminderDelivery(
        "event",
        "t",
        "p",
        "m",
        node,
        policy,
        "u",
        "overdue:0",
        OffsetDateTime.now().minusHours(1),
        "pending",
        0,
        null,
        null,
        null,
        null,
        null);
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void obsoleteNodeOrPolicyVersionCancelsPendingDeliveryWithoutSending(boolean nodeChanged) {
    var data = mock(AgencyExecutionMapper.class);
    var packages = mock(AgencyMapper.class);
    var guard = mock(AgencyGuard.class);
    when(guard.tenant()).thenReturn("t");
    var support =
        new AgencyExecutionSupport(guard, packages, data, json, null, null, null, null, null);
    var d = delivery(1, nodeChanged ? 0 : 1);
    var m =
        json.read(
            "{\"id\":\"m\",\"tenantId\":\"t\",\"packageId\":\"p\",\"status\":\"planned\",\"version\":"
                + (nodeChanged ? 2 : 1)
                + "}",
            Milestone.class);
    when(data.reminderDelivery("t", "event")).thenReturn(d);
    when(data.lockReminderDelivery("t", "event")).thenReturn(d);
    when(data.milestone("t", "m")).thenReturn(m);
    when(packages.lock("t", "p")).thenReturn(pkg());
    var notifications =
        mock(com.procurement.notification.application.NotificationApplicationService.class);
    new AgencyReminderService(support, null, null, notifications, null).deliver("event");
    verify(data).cancelReminder(eq("t"), eq("event"), contains("已变化"));
    verifyNoInteractions(notifications);
  }

  @Test
  void schedulerPersistsRetryStateAfterNotificationTransactionFailsAndClearsTenantContext() {
    var data = mock(AgencyExecutionMapper.class);
    var packages = mock(AgencyMapper.class);
    var support =
        new AgencyExecutionSupport(null, packages, data, null, null, null, null, null, null);
    var reminder = mock(AgencyReminderService.class);
    when(data.planTenants()).thenReturn(List.of("t"));
    when(data.reminderMilestones("t", "")).thenReturn(List.of());
    when(data.pendingReminders("t", "")).thenReturn(List.of(delivery(1, 0)));
    when(packages.find("t", "p")).thenReturn(pkg());
    doThrow(new IllegalStateException("synthetic store failure")).when(reminder).deliver("event");
    new AgencyExecutionWorker(data, null, null, support, null, null, null, reminder, null)
        .reminders();
    verify(data).failedReminder("t", "event");
    assertThat(com.procurement.common.tenant.TenantContext.tenantId()).isNull();
  }

  @Test
  void pendingProjectChangePausesDeliveryWithoutPermanentlyCancellingIt() {
    var data = mock(AgencyExecutionMapper.class);
    var packages = mock(AgencyMapper.class);
    var guard = mock(AgencyGuard.class);
    when(guard.tenant()).thenReturn("t");
    var support =
        new AgencyExecutionSupport(guard, packages, data, json, null, null, null, null, null);
    var d = delivery(1, 0);
    when(data.reminderDelivery("t", "event")).thenReturn(d);
    when(data.lockReminderDelivery("t", "event")).thenReturn(d);
    when(packages.lock("t", "p"))
        .thenReturn(
            json.read(
                "{\"id\":\"p\",\"tenantId\":\"t\",\"status\":\"approved\",\"workflowId\":\"pending-change\"}",
                PackageRow.class));
    var notifications =
        mock(com.procurement.notification.application.NotificationApplicationService.class);
    new AgencyReminderService(support, null, null, notifications, null).deliver("event");
    verify(data, never()).cancelReminder(anyString(), anyString(), anyString());
    verifyNoInteractions(notifications);
  }
}
