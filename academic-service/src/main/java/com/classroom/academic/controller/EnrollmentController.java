package com.classroom.academic.controller;

import com.classroom.academic.common.ApiResponse;
import com.classroom.academic.common.PaginatedResponse;
import com.classroom.academic.entity.engagement.Enrollment;
import com.classroom.academic.security.UserPrincipal;
import com.classroom.academic.service.EnrollmentService;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/enrollments")
public class EnrollmentController {

    private final EnrollmentService service;

    public EnrollmentController(EnrollmentService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<?> list(
            @RequestParam(required = false) Integer classId,
            @RequestParam(required = false) String studentId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int limit,
            @AuthenticationPrincipal UserPrincipal principal) {
        if ("student".equals(principal.getRole()) && !principal.getId().equals(studentId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }
        if (classId == null && studentId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "classId or studentId is required"));
        }
        var result = service.list(classId, studentId, page, limit);
        return ResponseEntity.ok(PaginatedResponse.of(result.getContent(), page, limit, result.getTotalElements()));
    }

    @PostMapping
    public ResponseEntity<?> enroll(@RequestBody Map<String, Object> body,
                                    @AuthenticationPrincipal UserPrincipal principal) {
        if ("student".equals(principal.getRole())) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }
        Object classIdRaw = body.get("classId");
        String studentId = (String) body.get("studentId");
        if (classIdRaw == null || studentId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "classId and studentId are required"));
        }
        try {
            Enrollment created = service.enroll(((Number) classIdRaw).intValue(), studentId);
            return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(created));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/self-enroll")
    public ResponseEntity<?> selfEnroll(@RequestBody Map<String, Object> body,
                                        @AuthenticationPrincipal UserPrincipal principal) {
        if (!"student".equals(principal.getRole())) {
            return ResponseEntity.status(403).body(Map.of("error", "Only students can self-enroll"));
        }
        Object classIdRaw = body.get("classId");
        if (classIdRaw == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "classId is required"));
        }
        try {
            EnrollmentService.SelfEnrollResult result = service.selfEnroll(
                    ((Number) classIdRaw).intValue(),
                    (String) body.get("inviteCode"),
                    principal.getId()
            );
            if (result.requiresPayment()) {
                return ResponseEntity.ok(ApiResponse.of(Map.of(
                        "requiresPayment", true,
                        "checkoutUrl", result.checkoutUrl()
                )));
            }
            return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(Map.of(
                    "requiresPayment", false,
                    "enrollment", result.enrollment()
            )));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Failed to enroll"));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> unenroll(@PathVariable Integer id,
                                      @AuthenticationPrincipal UserPrincipal principal) {
        if ("student".equals(principal.getRole())) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }
        try {
            service.unenroll(id);
            return ResponseEntity.ok(Map.of("data", Map.of("id", id)));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
    }
}
