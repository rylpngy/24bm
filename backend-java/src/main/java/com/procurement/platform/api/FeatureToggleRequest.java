package com.procurement.platform.api;

import jakarta.validation.constraints.NotNull;
import java.util.List;

public record FeatureToggleRequest(@NotNull List<String> enabledFeatures) {
}
