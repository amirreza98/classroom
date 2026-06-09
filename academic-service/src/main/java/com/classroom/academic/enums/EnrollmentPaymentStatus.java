package com.classroom.academic.enums;

import com.fasterxml.jackson.annotation.JsonValue;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

public enum EnrollmentPaymentStatus {
    FREE("free"), PENDING("pending"), PAID("paid"), FAILED("failed");

    private final String value;
    EnrollmentPaymentStatus(String value) { this.value = value; }

    @JsonValue
    public String getValue() { return value; }

    public static EnrollmentPaymentStatus fromValue(String value) {
        for (EnrollmentPaymentStatus s : values()) {
            if (s.value.equals(value)) return s;
        }
        throw new IllegalArgumentException("Unknown status: " + value);
    }

    @Converter(autoApply = true)
    public static class StatusConverter implements AttributeConverter<EnrollmentPaymentStatus, String> {
        @Override public String convertToDatabaseColumn(EnrollmentPaymentStatus s) { return s == null ? null : s.getValue(); }
        @Override public EnrollmentPaymentStatus convertToEntityAttribute(String v) { return v == null ? null : fromValue(v); }
    }
}