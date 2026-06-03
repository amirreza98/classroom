package notifications_service.notification.controller;

import notifications_service.notification.entity.Notification;
import notifications_service.notification.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/notifications")
public class NotificationController {

    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<?> getAll(
            @RequestHeader(value = "X-User-Id",    required = false) String userId,
            @RequestHeader(value = "X-User-Role",  required = false) String userRole,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail) {

        if (userId == null || userId.isBlank()) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        if ("admin".equals(userRole)) {
            return ResponseEntity.ok(service.getAll());
        }
        if (userEmail != null && !userEmail.isBlank()) {
            return ResponseEntity.ok(service.getByRecipientEmail(userEmail));
        }
        return ResponseEntity.ok(List.of());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getById(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id",    required = false) String userId,
            @RequestHeader(value = "X-User-Role",  required = false) String userRole,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail) {

        if (userId == null || userId.isBlank()) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        Notification notification = service.getById(id);
        if (!"admin".equals(userRole) && !notification.getRecipientEmail().equals(userEmail)) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }
        return ResponseEntity.ok(notification);
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<?> markAsRead(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id",    required = false) String userId,
            @RequestHeader(value = "X-User-Role",  required = false) String userRole,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail) {

        if (userId == null || userId.isBlank()) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        Notification notification = service.getById(id);
        if (!"admin".equals(userRole) && !notification.getRecipientEmail().equals(userEmail)) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }
        return ResponseEntity.ok(service.markAsRead(id));
    }

    @PostMapping
    public ResponseEntity<?> create(
            @RequestBody Notification notification,
            @RequestHeader(value = "X-User-Id",    required = false) String userId,
            @RequestHeader(value = "X-User-Role",  required = false) String userRole,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail) {

        if (userId == null || userId.isBlank()) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        // Non-admins can only create notifications for themselves
        if (!"admin".equals(userRole)) {
            notification.setRecipientEmail(userEmail);
        }
        return ResponseEntity.status(201).body(service.create(notification));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id",    required = false) String userId,
            @RequestHeader(value = "X-User-Role",  required = false) String userRole,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail) {

        if (userId == null || userId.isBlank()) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        Notification notification = service.getById(id);
        if (!"admin".equals(userRole) && !notification.getRecipientEmail().equals(userEmail)) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
