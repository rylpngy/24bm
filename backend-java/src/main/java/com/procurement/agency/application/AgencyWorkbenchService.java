package com.procurement.agency.application;

import com.procurement.agency.infrastructure.AgencyWorkbenchMapper;
import com.procurement.agency.domain.AgencyWorkbenchRecords.*;
import java.time.*;
import java.time.format.DateTimeParseException;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public record AgencyWorkbenchService(AgencyGuard guard, AgencyWorkbenchMapper mapper) {
  public List<CalendarEvent> calendar(String month) {
    guard.permissions().require("buyer:agency:read");
    guard.permissions().require("buyer:agency:document:read");
    YearMonth requested;
    try { requested=YearMonth.parse(month); } catch(DateTimeParseException e) { throw new IllegalArgumentException("月份格式应为YYYY-MM"); }
    var scope=guard.scopes().currentUserDataScope();
    var events=new ArrayList<CalendarEvent>();
    for(var row:mapper.calendar(guard.tenant(),guard.actor(),!scope.restricted(),scope.departmentIds())) {
      LocalDateTime time;
      try { time=OffsetDateTime.parse(row.openingAt()).atZoneSameInstant(ZoneId.of("Asia/Shanghai")).toLocalDateTime(); }
      catch(DateTimeParseException e) {
        try { time=LocalDateTime.parse(row.openingAt()); } catch(DateTimeParseException ignored) { continue; }
      }
      if(YearMonth.from(time).equals(requested)) events.add(new CalendarEvent(row.packageId(),row.title(),row.number(),row.procurementMethod(),row.ownerName(),time.toString(),row.venue(),time.toLocalDate().toString()));
    }
    events.sort(Comparator.comparing(CalendarEvent::openingAt).thenComparing(CalendarEvent::packageId));
    return List.copyOf(events);
  }
  public DocumentPage documents(int page,int pageSize,String keyword,String kind) {
    guard.permissions().require("buyer:agency:read");guard.permissions().require("buyer:agency:document:read");
    if(!List.of("","purchase","announcement").contains(kind)) throw new IllegalArgumentException("文件类型无效");
    int p=Math.max(1,Math.min(page,100000)),size=Math.max(1,Math.min(pageSize,100));
    var s=guard.scopes().currentUserDataScope();String t=guard.tenant(),a=guard.actor();
    return new DocumentPage(mapper.documents(t,a,!s.restricted(),s.departmentIds(),keyword,kind,size,(p-1)*size),mapper.documentCount(t,a,!s.restricted(),s.departmentIds(),keyword,kind),p,size);
  }
}
