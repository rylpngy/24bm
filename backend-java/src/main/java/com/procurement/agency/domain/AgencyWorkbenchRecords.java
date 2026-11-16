package com.procurement.agency.domain;
import java.time.OffsetDateTime;
import java.util.List;
public final class AgencyWorkbenchRecords {
  private AgencyWorkbenchRecords() {}
  public record CalendarRow(String packageId,String title,String number,String procurementMethod,String ownerName,String openingAt,String venue) {}
  public record CalendarEvent(String packageId,String title,String number,String procurementMethod,String ownerName,String openingAt,String venue,String day) {}
  public record DocumentRow(String packageId,String title,String number,String procurementMethod,String documentId,String kind,String status,String revisionId,String revisionStatus,Long inputVersion,OffsetDateTime createdAt) {}
  public record DocumentPage(List<DocumentRow> items,long total,int page,int pageSize) {}
}
