package com.procurement.numbering.api;

import com.procurement.numbering.domain.NumberingRule;
import jakarta.validation.constraints.NotNull;

public record SaveNumberingRuleRequest(@NotNull String prefix, @NotNull String dateFormat,
    @NotNull Integer width, @NotNull Boolean enabled) {
  NumberingRule toRule(String type) { return new NumberingRule(type, prefix, dateFormat, width, enabled); }
}
