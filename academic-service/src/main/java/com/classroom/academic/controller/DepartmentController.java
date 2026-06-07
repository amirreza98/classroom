package com.classroom.academic.controller;

import com.classroom.academic.common.ApiResponse;
import com.classroom.academic.common.PaginatedResponse;
import com.classroom.academic.entity.academic.Department;
import com.classroom.academic.security.UserPrincipal;
import com.classroom.academic.service.DepartmentService;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/departments")
public class DepartmentController {

    private final DepartmentService service;

    public DepartmentController(DepartmentService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<?> list(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit) {
        var result = service.list(search, page, limit);
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
    public ResponseEntity<?> create(@RequestBody Map<String, String> body) {
        String code = body.get("code");
        String name = body.get("name");
        if (code == null || name == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "code and name are required"));
        }
        try {
            Department created = service.create(code, name, body.get("description"));
            return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(created));
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            return ResponseEntity.status(409).body(Map.of("error", "Department code already exists"));
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> update(@PathVariable Integer id, @RequestBody Map<String, String> body) {
        try {
            Department updated = service.update(id, body.get("code"), body.get("name"), body.get("description"));
            return ResponseEntity.ok(ApiResponse.of(updated));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            return ResponseEntity.status(409).body(Map.of("error", "Department code already exists"));
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> delete(@PathVariable Integer id) {
        try {
            Department dept = service.getById(id);
            service.delete(id);
            return ResponseEntity.ok(ApiResponse.of(dept));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).body(Map.of("error", e.getMessage()));
        }
    }
}
