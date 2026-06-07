package com.classroom.academic.enums;

import com.fasterxml.jackson.annotation.JsonValue;

public enum PaymentRecordStatus {
    PENDING("pending"),
    PAID("paid"),
    FAILED("failed");

    private final String value;

    PaymentRecordStatus(String value) { this.value = value; }

    @JsonValue
    public String getValue() { return value; }
}
