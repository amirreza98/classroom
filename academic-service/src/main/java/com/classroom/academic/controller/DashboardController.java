package com.classroom.academic.controller;

import com.classroom.academic.common.ApiResponse;
import com.classroom.academic.security.UserPrincipal;
import jakarta.persistence.EntityManager;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final EntityManager em;

    public DashboardController(EntityManager em) {
        this.em = em;
    }

    @GetMapping("/stats")
    public ResponseEntity<?> stats(@AuthenticationPrincipal UserPrincipal principal) {
        if ("student".equals(principal.getRole())) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }

        long totalDepartments = count("SELECT COUNT(*) FROM academic.departments");
        long totalSubjects    = count("SELECT COUNT(*) FROM academic.subjects");
        long totalClasses     = count("SELECT COUNT(*) FROM academic.classes");
        long totalEnrollments = count("SELECT COUNT(*) FROM engagement.enrollments");
        long activeClasses    = count("SELECT COUNT(*) FROM academic.classes WHERE status = 'active'");
        // Cross-schema: user counts from auth schema (same DB)
        long totalUsers    = count("SELECT COUNT(*) FROM auth.\"user\"");
        long totalStudents = count("SELECT COUNT(*) FROM auth.\"user\" WHERE role = 'student'");
        long totalTeachers = count("SELECT COUNT(*) FROM auth.\"user\" WHERE role = 'teacher'");

        return ResponseEntity.ok(ApiResponse.of(Map.of(
                "totalDepartments", totalDepartments,
                "totalSubjects", totalSubjects,
                "totalClasses", totalClasses,
                "totalEnrollments", totalEnrollments,
                "activeClasses", activeClasses,
                "totalUsers", totalUsers,
                "totalStudents", totalStudents,
                "totalTeachers", totalTeachers
        )));
    }

    @GetMapping("/charts")
    public ResponseEntity<?> charts(@AuthenticationPrincipal UserPrincipal principal) {
        if ("student".equals(principal.getRole())) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }

        List<?> enrollmentTrends = em.createNativeQuery("""
            SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') AS month,
                   COUNT(*) AS count
            FROM engagement.enrollments
            WHERE created_at >= NOW() - INTERVAL '6 months'
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY DATE_TRUNC('month', created_at) ASC
            """).getResultList();

        List<?> classesByDept = em.createNativeQuery("""
            SELECT d.name AS department, COUNT(c.id) AS count
            FROM academic.departments d
            LEFT JOIN academic.subjects s ON s.department_id = d.id
            LEFT JOIN academic.classes c ON c.subject_id = s.id
            GROUP BY d.id, d.name
            ORDER BY count DESC
            LIMIT 8
            """).getResultList();

        List<?> capacityData = em.createNativeQuery("""
            SELECT CASE
                WHEN enrolled_count = 0 THEN 'Empty'
                WHEN enrolled_count::float / capacity < 0.5 THEN 'Low (<50%)'
                WHEN enrolled_count::float / capacity < 0.8 THEN 'Medium (50-80%)'
                WHEN enrolled_count::float / capacity < 1.0 THEN 'High (80-99%)'
                ELSE 'Full'
            END AS status, COUNT(*) AS count
            FROM (
                SELECT c.id, c.capacity, COUNT(e.id) AS enrolled_count
                FROM academic.classes c
                LEFT JOIN engagement.enrollments e ON e.class_id = c.id
                GROUP BY c.id, c.capacity
            ) sub
            GROUP BY status ORDER BY count DESC
            """).getResultList();

        List<?> userDist = em.createNativeQuery("""
            SELECT role, COUNT(*) AS count FROM auth."user" GROUP BY role
            """).getResultList();

        return ResponseEntity.ok(ApiResponse.of(Map.of(
                "enrollmentTrends", enrollmentTrends,
                "classesByDepartment", classesByDept,
                "capacityStatus", capacityData,
                "userDistribution", userDist
        )));
    }

    private long count(String sql) {
        Object result = em.createNativeQuery(sql).getSingleResult();
        return ((Number) result).longValue();
    }
}
