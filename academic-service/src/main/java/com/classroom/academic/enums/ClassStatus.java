package com.classroom.academic.enums;

import com.fasterxml.jackson.annotation.JsonValue;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

public enum ClassStatus {
    ACTIVE("active"),
    INACTIVE("inactive"),
    ARCHIVED("archived");

    private final String value;

    ClassStatus(String value) { this.value = value; }

    @JsonValue
    public String getValue() { return value; }

    public static ClassStatus fromValue(String value) {
        for (ClassStatus s : values()) {
            if (s.value.equals(value)) return s;
        }
        throw new IllegalArgumentException("Unknown status: " + value);
    }

    @Converter(autoApply = true)
    public static class ClassStatusConverter implements AttributeConverter<ClassStatus, String> {
        @Override
        public String convertToDatabaseColumn(ClassStatus status) {
            return status == null ? null : status.getValue();
        }

        @Override
        public ClassStatus convertToEntityAttribute(String value) {
            return value == null ? null : ClassStatus.fromValue(value);
        }
    }
}