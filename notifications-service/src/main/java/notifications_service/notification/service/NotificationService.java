package notifications_service.notification.service;

import notifications_service.notification.entity.Notification;
import notifications_service.notification.exception.NotificationNotFoundException;
import notifications_service.notification.repository.NotificationRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class NotificationService {

    private final NotificationRepository repository;

    public NotificationService(NotificationRepository repository) {
        this.repository = repository;
    }

    public List<Notification> getAll() {
        return repository.findAll();
    }

    public Notification getById(Long id){
        return repository.findById(id)
                .orElseThrow(() -> new NotificationNotFoundException(id));
    }

    public Notification create(Notification notification) {
        return repository.save(notification);
    }

    public Notification markAsRead(Long id){
        Notification notification = getById(id);
        notification.setRead(true);
        return repository.save(notification);
    }

    public void delete(Long id) {
        repository.deleteById(id);
    }
}