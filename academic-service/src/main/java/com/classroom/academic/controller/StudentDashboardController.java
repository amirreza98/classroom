package com.classroom.academic.controller;

import com.classroom.academic.common.ApiResponse;
import com.classroom.academic.security.UserPrincipal;
import com.classroom.academic.service.EnrollmentService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/student-dashboard")
public class StudentDashboardController {

    private final EnrollmentService enrollmentService;

    public StudentDashboardController(EnrollmentService enrollmentService) {
        this.enrollmentService = enrollmentService;
    }

    @GetMapping("/overview")
    public ResponseEntity<?> overview(@AuthenticationPrincipal UserPrincipal principal) {
        var enrolledClasses = enrollmentService.getStudentEnrollmentsWithDetails(principal.getId());
        return ResponseEntity.ok(ApiResponse.of(Map.of("enrolledClasses", enrolledClasses)));
    }
}
