package com.railway.alert.model;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class Alert {
    private UUID locomotiveId;
    private String code;
    private String title;
    private Severity severity;
    private String suggestedAction;
    private Instant ts;
    private boolean open;
}
