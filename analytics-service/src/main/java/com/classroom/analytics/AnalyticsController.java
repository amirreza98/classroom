package com.classroom.analytics;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health(HttpServletRequest request) {
        GatewayUser user = (GatewayUser) request.getAttribute(GatewayHeaderFilter.GATEWAY_USER_ATTR);
        if (user != null) {
            log.debug("Health check by userId={} role={}", user.userId(), user.role());
        }
        return ResponseEntity.ok(Map.of("status", "ok", "service", "analytics"));
    }

    @GetMapping("/events")
    public ResponseEntity<Map<String, Object>> getEvents(HttpServletRequest request) {
        GatewayUser user = (GatewayUser) request.getAttribute(GatewayHeaderFilter.GATEWAY_USER_ATTR);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        log.info("Events requested by userId={} role={}", user.userId(), user.role());
        return ResponseEntity.ok(Map.of("userId", user.userId(), "role", user.role(), "events", new Object[0]));
    }
}
