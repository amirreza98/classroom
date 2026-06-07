package com.classroom.academic.entity.management;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "notifications", schema = "management")
@Getter @Setter
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    // References auth.user.id
    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;

    @Column(nullable = false)
    private Boolean read = false;

    // e.g. "enrollment", "grade", "announcement"
    @Column(length = 50)
    private String type;

    // Optional ID of the related entity (classId, gradeId, etc.)
    @Column(name = "reference_id")
    private Integer referenceId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
