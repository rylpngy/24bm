package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyRecords.FileRow;
import com.procurement.agency.infrastructure.*;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class AgencyReportFileAccess {
  private final AgencyRecommendationMapper reports;
  private final AgencyAssessmentMapper sessions;
  private final AgencyEvaluationMapper rounds;
  private final AgencyGuard guard;
  private final AgencyJson json;

  public AgencyReportFileAccess(
      AgencyRecommendationMapper reports,
      AgencyAssessmentMapper sessions,
      AgencyEvaluationMapper rounds,
      AgencyGuard guard,
      AgencyJson json) {
    this.reports = reports;
    this.sessions = sessions;
    this.rounds = rounds;
    this.guard = guard;
    this.json = json;
  }

  public boolean visible(FileRow file) {
    if (!guard.permissions().currentUserHas("buyer:agency:report:read")
        || !guard.permissions().currentUserHas("buyer:agency:report:confidential")) return false;
    var report = reports.fileReport(guard.tenant(), file.id());
    if (report == null) return false;
    var session = sessions.session(guard.tenant(), report.sessionId());
    var round = session == null ? null : rounds.round(guard.tenant(), session.roundId());
    if (round == null
        || !Objects.equals(round.frozenHash(), session.roundHash())
        || !json.hash(json.read(round.frozenJson(), Map.class)).equals(round.frozenHash()))
      return false;
    var cfg =
        json.read(
            json.tree(round.frozenJson()).path("config").toString(),
            com.procurement.agency.domain.AgencyEvaluationRecords.Config.class);
    return guard.permissions().currentUserHas("buyer:agency:report:approve")
        || cfg.members().stream()
            .anyMatch(
                m ->
                    m.userId().equals(guard.actor())
                        && (m.roles().contains("organizer") || m.roles().contains("leader")));
  }
}
