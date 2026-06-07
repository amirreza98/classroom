package com.classroom.academic.enums;

import com.fasterxml.jackson.annotation.JsonValue;

public enum EnrollmentPaymentStatus {
    FREE("free"),
    PENDING("pending"),
    PAID("paid"),
    FAILED("failed");

    private final String value;

    EnrollmentPaymentStatus(String value) { this.value = value; }

    @JsonValue
    public String getValue() { return value; }
}
