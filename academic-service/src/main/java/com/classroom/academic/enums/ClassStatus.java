package com.classroom.academic.enums;

import com.fasterxml.jackson.annotation.JsonValue;

public enum ClassStatus {
    ACTIVE("active"),
    INACTIVE("inactive"),
    ARCHIVED("archived");

    private final String value;

    ClassStatus(String value) { this.value = value; }

    @JsonValue
    public String getValue() { return value; }
}
