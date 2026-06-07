package com.classroom.academic.service;

import com.classroom.academic.entity.academic.ClassEntity;
import com.classroom.academic.entity.academic.Subject;
import com.classroom.academic.enums.ClassStatus;
import com.classroom.academic.kafka.EventPublisher;
import com.classroom.academic.repository.academic.ClassRepository;
import com.classroom.academic.repository.academic.SubjectRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class ClassService {

    private final ClassRepository repo;
    private final SubjectRepository subjectRepo;
    private final EventPublisher events;

    public ClassService(ClassRepository repo, SubjectRepository subjectRepo, EventPublisher events) {
        this.repo = repo;
        this.subjectRepo = subjectRepo;
        this.events = events;
    }

    public Page<ClassEntity> list(String search, String subject, String teacher, int page, int limit) {
        PageRequest pageable = PageRequest.of(page - 1, limit, Sort.by("createdAt").descending());
        String s = blank(search), sub = blank(subject), t = blank(teacher);
        return repo.findWithFilters(s, sub, t, pageable);
    }

    public ClassEntity getById(Integer id) {
        return repo.findById(id).orElseThrow(() -> new EntityNotFoundException("Class not found"));
    }

    @Transactional
    public ClassEntity create(Integer subjectId, String teacherId, String name, String description,
                              Integer capacity, String bannerUrl, String bannerCldPubId) {
        Subject subject = subjectRepo.findById(subjectId)
                .orElseThrow(() -> new EntityNotFoundException("Subject not found"));

        ClassEntity cls = new ClassEntity();
        cls.setSubject(subject);
        cls.setTeacherId(teacherId);
        cls.setName(name);
        cls.setDescription(description);
        cls.setCapacity(capacity != null ? capacity : 50);
        cls.setBannerUrl(bannerUrl);
        cls.setBannerCldPubId(bannerCldPubId);
        cls.setInviteCode(UUID.randomUUID().toString().replace("-", "").substring(0, 7));
        cls.setStatus(ClassStatus.ACTIVE);
        cls.setSchedules("[]");

        ClassEntity saved = repo.save(cls);

        events.publish("student.actions", Map.of(
                "event", "class.created",
                "classId", saved.getId(),
                "timestamp", Instant.now().toString()
        ));

        return saved;
    }

    @Transactional
    public ClassEntity update(Integer id, String name, String description, Integer subjectId,
                              String teacherId, Integer capacity, ClassStatus status,
                              String bannerUrl, String bannerCldPubId) {
        ClassEntity cls = getById(id);
        if (name != null) cls.setName(name);
        if (description != null) cls.setDescription(description);
        if (subjectId != null) {
            Subject subject = subjectRepo.findById(subjectId)
                    .orElseThrow(() -> new EntityNotFoundException("Subject not found"));
            cls.setSubject(subject);
        }
        if (teacherId != null) cls.setTeacherId(teacherId);
        if (capacity != null) cls.setCapacity(capacity);
        if (status != null) cls.setStatus(status);
        if (bannerUrl != null) cls.setBannerUrl(bannerUrl);
        if (bannerCldPubId != null) cls.setBannerCldPubId(bannerCldPubId);
        return repo.save(cls);
    }

    @Transactional
    public void delete(Integer id) {
        ClassEntity cls = getById(id);
        repo.delete(cls);
    }

    private String blank(String s) {
        return (s != null && !s.isBlank()) ? s : null;
    }
}
