package com.procurement.agency;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.procurement.agency.application.*;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.agency.domain.AgencyWorkbenchRecords.*;
import com.procurement.agency.infrastructure.AgencyWorkbenchMapper;
import com.procurement.identity.application.*;
import com.procurement.identity.domain.DataScope;
import java.util.*;
import org.junit.jupiter.api.Test;

class AgencyWorkbenchTests {
  final AgencyGuard guard=mock(AgencyGuard.class);
  final PermissionService permissions=mock(PermissionService.class);
  final DataScopeService scopes=mock(DataScopeService.class);
  final AgencyWorkbenchMapper mapper=mock(AgencyWorkbenchMapper.class);
  final AgencyWorkbenchService service=new AgencyWorkbenchService(guard,mapper);
  AgencyWorkbenchTests(){
    when(guard.permissions()).thenReturn(permissions);when(guard.scopes()).thenReturn(scopes);
    when(guard.tenant()).thenReturn("t");when(guard.actor()).thenReturn("u");
    when(scopes.currentUserDataScope()).thenReturn(DataScope.self("u"));
  }
  CalendarRow row(String id,String time){return new CalendarRow(id,id,"N","公开招标","负责人",time,"开标室");}
  @Test void calendarUsesShanghaiDayAndRejectsBadOrUnscheduledDates(){
    when(mapper.calendar("t","u",false,List.of())).thenReturn(List.of(
      row("boundary","2026-10-31T16:30:00Z"),row("later","2026-11-02T09:00"),
      row("outside","2026-11-30T16:00:00Z"),row("bad","not-a-date")));
    var events=service.calendar("2026-11");
    assertThat(events).extracting(CalendarEvent::packageId).containsExactly("boundary","later");
    assertThat(events.getFirst().day()).isEqualTo("2026-11-01");
    assertThat(events.getFirst().openingAt()).isEqualTo("2026-11-01T00:30");
    verify(permissions).require("buyer:agency:document:read");
  }
  @Test void departmentScopeAndTenantArePassedToDocumentRowsAndCount(){
    when(scopes.currentUserDataScope()).thenReturn(DataScope.departments(List.of("d")));
    when(mapper.documents("t","u",false,List.of("d"),"关键字","purchase",100,100)).thenReturn(List.of());
    when(mapper.documentCount("t","u",false,List.of("d"),"关键字","purchase")).thenReturn(101L);
    var page=service.documents(2,200,"关键字","purchase");
    assertThat(page.pageSize()).isEqualTo(100);assertThat(page.total()).isEqualTo(101);
    verify(mapper).documents("t","u",false,List.of("d"),"关键字","purchase",100,100);
  }
  @Test void deniedPermissionNeverReachesCalendarQuery(){
    doThrow(new PermissionDeniedException("denied")).when(permissions).require("buyer:agency:document:read");
    assertThatThrownBy(()->service.calendar("2026-11")).isInstanceOf(PermissionDeniedException.class);
    verifyNoInteractions(mapper);
  }
  @Test void invalidMonthAndKindAreRejectedBeforeQuery(){
    assertThatThrownBy(()->service.calendar("2026-13")).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(()->service.documents(1,15,"","bad")).isInstanceOf(IllegalArgumentException.class);
    verifyNoInteractions(mapper);
  }
}
