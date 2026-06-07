package com.classroom.academic.controller;

import com.classroom.academic.common.ApiResponse;
import com.classroom.academic.common.PaginatedResponse;
import com.classroom.academic.security.UserPrincipal;
import com.classroom.academic.service.PaymentService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private final PaymentService service;

    public PaymentController(PaymentService service) {
        this.service = service;
    }

    @GetMapping("/my")
    public ResponseEntity<?> myPayments(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(ApiResponse.of(service.getMyPayments(principal.getId())));
    }

    @GetMapping
    public ResponseEntity<?> listAll(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int limit,
            @AuthenticationPrincipal UserPrincipal principal) {
        if (!"admin".equals(principal.getRole())) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }
        var result = service.listAll(page, limit);
        return ResponseEntity.ok(PaginatedResponse.of(result.getContent(), page, limit, result.getTotalElements()));
    }
}
