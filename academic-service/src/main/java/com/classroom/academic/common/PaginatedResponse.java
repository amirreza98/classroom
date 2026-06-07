package com.classroom.academic.common;

import java.util.List;

public record PaginatedResponse<T>(List<T> data, Pagination pagination) {
    public static <T> PaginatedResponse<T> of(List<T> data, int page, int limit, long total) {
        return new PaginatedResponse<>(data, Pagination.of(page, limit, total));
    }
}
