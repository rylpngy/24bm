package com.procurement.agency.application;

import com.procurement.agency.infrastructure.*;
import java.util.*;
import org.springframework.stereotype.Component;

/**
 * Dependency stamps contain source data only; lifecycle fees/archive flags do not change evaluation
 * content versions.
 */
@Component
public class AgencyEvaluationEvidence {
  private final AgencyAssessmentContext c;
  private final AgencyOpeningMapper opening;
  private final AgencyQuoteMapper quotes;
  private final AgencyFinalQuoteMapper finals;
  private final AgencyFinalResponseMapper responses;
  private final AgencyMethodMapper methods;
  private final AgencyPriceMapper prices;
  private final AgencyTotalMapper totals;
  private final AgencyRequirementChangeMapper changes;
  private final AgencyDiscussionMapper discussions;
  private final AgencyIncidentMapper incidents;

  public AgencyEvaluationEvidence(
      AgencyAssessmentContext c,
      AgencyOpeningMapper opening,
      AgencyQuoteMapper quotes,
      AgencyFinalQuoteMapper finals,
      AgencyFinalResponseMapper responses,
      AgencyMethodMapper methods,
      AgencyPriceMapper prices,
      AgencyTotalMapper totals,
      AgencyRequirementChangeMapper changes,
      AgencyDiscussionMapper discussions,
      AgencyIncidentMapper incidents) {
    this.c = c;
    this.opening = opening;
    this.quotes = quotes;
    this.finals = finals;
    this.responses = responses;
    this.methods = methods;
    this.prices = prices;
    this.totals = totals;
    this.changes = changes;
    this.discussions = discussions;
    this.incidents = incidents;
  }

  public String stamp(String tenant, String session) {
    var s = c.data.session(tenant, session);
    if (s == null) throw new IllegalArgumentException("评审任务不存在");
    var parts = new ArrayList<Object>();
    parts.add(s);
    parts.add(c.rounds.round(tenant, s.roundId()));
    parts.add(c.s.packages.find(tenant, s.packageId()).version());
    parts.add(opening.stages(tenant, session));
    parts.add(opening.opening(tenant, s.roundId()));
    var config =
        c.s.json.read(
            c.s
                .json
                .tree(c.rounds.round(tenant, s.roundId()).frozenJson())
                .path("config")
                .toString(),
            com.procurement.agency.domain.AgencyEvaluationRecords.Config.class);
    for (var m : config.members()) {
      parts.add(c.data.sheets(tenant, session, m.userId()));
      parts.add(c.data.corrections(tenant, session, m.userId()));
    }
    parts.add(quotes.list(tenant, session));
    parts.add(finals.campaign(tenant, session));
    parts.add(responses.plan(tenant, session));
    parts.add(responses.sheets(tenant, session));
    parts.add(responses.corrections(tenant, session));
    parts.add(methods.history(tenant, s.roundId()));
    parts.add(prices.rule(tenant, session));
    parts.add(totals.rule(tenant, session));
    parts.add(prices.history(tenant, session));
    parts.add(totals.history(tenant, session));
    parts.add(incidents.incidents(tenant, s.roundId()));
    parts.add(incidents.events(tenant, s.roundId()));
    parts.add(changes.changes(tenant, session));
    parts.add(changes.receipts(tenant, session));
    parts.add(discussions.plan(tenant, session));
    parts.add(discussions.records(tenant, session));
    parts.add(c.controls.marker(s.roundId()));
    return c.s.json.hash(parts);
  }
}
