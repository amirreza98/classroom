package com.classroom.academic.common;

public record Pagination(int page, int limit, long total, int totalPages) {
    public static Pagination of(int page, int limit, long total) {
        int totalPages = limit > 0 ? (int) Math.ceil((double) total / limit) : 0;
        return new Pagination(page, limit, total, totalPages);
    }
}
