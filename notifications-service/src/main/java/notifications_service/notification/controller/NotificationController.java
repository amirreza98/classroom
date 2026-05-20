package notifications_service.notification.controller;

import notifications_service.notification.entity.Notification;
import notifications_service.notification.service.NotificationService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/notifications")
public class NotificationController {

    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    @GetMapping
    public List<Notification> getAll() {
        return service.getAll();
    }

    @GetMapping("/{id}")
    public Notification getById(@PathVariable Long id) {
        return service.getById(id);
    }

    @PatchMapping("/{id}/read")
    public Notification markAsRead(@PathVariable Long id){
        return service.markAsRead(id);
    }

    @PostMapping
    public Notification create(@RequestBody Notification notification) {
        return service.create(notification);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id){
        service.delete(id);
    }
}