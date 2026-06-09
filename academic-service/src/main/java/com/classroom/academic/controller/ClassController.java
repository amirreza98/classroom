package com.classroom.academic.controller;

import com.classroom.academic.common.ApiResponse;
import com.classroom.academic.common.PaginatedResponse;
import com.classroom.academic.entity.academic.ClassEntity;
import com.classroom.academic.enums.ClassStatus;
import com.classroom.academic.security.UserPrincipal;
import com.classroom.academic.service.ClassService;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/classes")
public class ClassController {

    private final ClassService service;

    public ClassController(ClassService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<?> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String subject,
            @RequestParam(required = false) String teacher,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit) {
        var result = service.list(search, subject, teacher, page, limit);
        return ResponseEntity.ok(PaginatedResponse.of(result.getContent(), page, limit, result.getTotalElements()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable Integer id) {
        try {
            return ResponseEntity.ok(ApiResponse.of(service.getById(id)));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body,
                                    @AuthenticationPrincipal UserPrincipal principal) {
        if ("student".equals(principal.getRole())) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }
        try {
            Object subjectIdRaw = body.get("subjectId");
            if (body.get("name") == null || subjectIdRaw == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "name and subjectId are required"));
            }
            Integer subjectId = ((Number) subjectIdRaw).intValue();
            String teacherId = body.getOrDefault("teacherId", principal.getId()).toString();
            Integer capacity = body.get("capacity") != null ? ((Number) body.get("capacity")).intValue() : null;

            ClassEntity created = service.create(subjectId, teacherId, (String) body.get("name"),
                    (String) body.get("description"), capacity,
                    (String) body.get("bannerUrl"), (String) body.get("bannerCldPubId"));
            return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(created));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Failed to create class"));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Integer id,
                                    @RequestBody Map<String, Object> body,
                                    @AuthenticationPrincipal UserPrincipal principal) {
        if ("student".equals(principal.getRole())) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }
        try {
            Integer subjectId = body.get("subjectId") != null ? ((Number) body.get("subjectId")).intValue() : null;
            Integer capacity = body.get("capacity") != null ? ((Number) body.get("capacity")).intValue() : null;
            ClassStatus status = body.get("status") != null
                    ? ClassStatus.valueOf(body.get("status").toString().toLowerCase()) : null;

            ClassEntity updated = service.update(id, (String) body.get("name"), (String) body.get("description"),
                    subjectId, (String) body.get("teacherId"), capacity, status,
                    (String) body.get("bannerUrl"), (String) body.get("bannerCldPubId"));
            return ResponseEntity.ok(ApiResponse.of(updated));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Failed to update class"));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Integer id,
                                    @AuthenticationPrincipal UserPrincipal principal) {
        if (!"admin".equals(principal.getRole())) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }
        try {
            ClassEntity cls = service.getById(id);
            service.delete(id);
            return ResponseEntity.ok(ApiResponse.of(cls));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
    }
}
