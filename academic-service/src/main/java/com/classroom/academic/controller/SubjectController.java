package com.classroom.academic.controller;

import com.classroom.academic.common.ApiResponse;
import com.classroom.academic.common.PaginatedResponse;
import com.classroom.academic.entity.academic.Subject;
import com.classroom.academic.service.SubjectService;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

@RestController
@RequestMapping("/api/subjects")
public class SubjectController {

    private final SubjectService service;

    public SubjectController(SubjectService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<?> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String department,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit) {
        var result = service.list(search, department, page, limit);
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
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        String name = (String) body.get("name");
        String code = (String) body.get("code");
        Object deptIdRaw = body.get("departmentId");
        if (name == null || code == null || deptIdRaw == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "name, code, and departmentId are required"));
        }
        try {
            Integer departmentId = ((Number) deptIdRaw).intValue();
            BigDecimal price = body.get("price") != null
                    ? new BigDecimal(body.get("price").toString()) : BigDecimal.ZERO;
            Subject created = service.create(name, code, (String) body.get("description"), departmentId, price);
            return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(created));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            return ResponseEntity.status(409).body(Map.of("error", "Subject code already exists"));
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> update(@PathVariable Integer id, @RequestBody Map<String, Object> body) {
        try {
            Integer departmentId = body.get("departmentId") != null
                    ? ((Number) body.get("departmentId")).intValue() : null;
            BigDecimal price = body.get("price") != null
                    ? new BigDecimal(body.get("price").toString()) : null;
            Subject updated = service.update(id, (String) body.get("name"), (String) body.get("code"),
                    (String) body.get("description"), departmentId, price);
            return ResponseEntity.ok(ApiResponse.of(updated));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            return ResponseEntity.status(409).body(Map.of("error", "Subject code already exists"));
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> delete(@PathVariable Integer id) {
        try {
            Subject subject = service.getById(id);
            service.delete(id);
            return ResponseEntity.ok(ApiResponse.of(subject));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).body(Map.of("error", e.getMessage()));
        }
    }
}
