package com.classroom.academic.enums;

import com.fasterxml.jackson.annotation.JsonValue;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

public enum PaymentRecordStatus {
    PENDING("pending"), PAID("paid"), FAILED("failed");

    private final String value;
    PaymentRecordStatus(String value) { this.value = value; }

    @JsonValue
    public String getValue() { return value; }

    public static PaymentRecordStatus fromValue(String value) {
        for (PaymentRecordStatus s : values()) {
            if (s.value.equals(value)) return s;
        }
        throw new IllegalArgumentException("Unknown status: " + value);
    }

    @Converter(autoApply = true)
    public static class Converter implements AttributeConverter<PaymentRecordStatus, String> {
        @Override public String convertToDatabaseColumn(PaymentRecordStatus s) { return s == null ? null : s.getValue(); }
        @Override public PaymentRecordStatus convertToEntityAttribute(String v) { return v == null ? null : fromValue(v); }
    }
}