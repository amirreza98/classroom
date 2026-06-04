package com.classroom.analytics;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final StudentEventRepository studentEventRepository;

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health(HttpServletRequest request) {
        GatewayUser user = (GatewayUser) request.getAttribute(GatewayHeaderFilter.GATEWAY_USER_ATTR);
        if (user != null) {
            log.debug("Health check by userId={} role={}", user.userId(), user.role());
        }
        return ResponseEntity.ok(Map.of("status", "ok", "service", "analytics-service"));
    }

    // GET /api/analytics/student/{studentId}/stats
    @GetMapping("/student/{studentId}/stats")
    public ResponseEntity<?> getStudentStats(
            @PathVariable String studentId,
            HttpServletRequest request) {

        GatewayUser gatewayUser = (GatewayUser) request.getAttribute(GatewayHeaderFilter.GATEWAY_USER_ATTR);
        if (gatewayUser == null || gatewayUser.userId() == null || gatewayUser.userId().isBlank()) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        if ("student".equals(gatewayUser.role()) && !gatewayUser.userId().equals(studentId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }

        List<Object[]> rows = studentEventRepository.countByTypeForStudent(studentId);
        Map<String, Long> stats = new HashMap<>();
        for (Object[] row : rows) {
            stats.put((String) row[0], (Long) row[1]);
        }

        return ResponseEntity.ok(Map.of("studentId", studentId, "stats", stats));
    }

    // GET /api/analytics/student/{studentId}/recent?limit=20
    @GetMapping("/student/{studentId}/recent")
    public ResponseEntity<?> getRecentEvents(
            @PathVariable String studentId,
            @RequestParam(defaultValue = "20") int limit,
            HttpServletRequest request) {

        GatewayUser gatewayUser = (GatewayUser) request.getAttribute(GatewayHeaderFilter.GATEWAY_USER_ATTR);
        if (gatewayUser == null || gatewayUser.userId() == null || gatewayUser.userId().isBlank()) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        if ("student".equals(gatewayUser.role()) && !gatewayUser.userId().equals(studentId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }

        int safeLimit = Math.min(Math.max(1, limit), 100);
        List<StudentEvent> events = studentEventRepository
                .findByStudentIdOrderByCreatedAtDesc(studentId, PageRequest.of(0, safeLimit));

        return ResponseEntity.ok(Map.of("data", events));
    }
}
