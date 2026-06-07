package com.classroom.academic.entity.academic;

import com.classroom.academic.enums.ClassStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "classes", schema = "academic")
@Getter @Setter
public class ClassEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subject_id", nullable = false)
    private Subject subject;

    // Stores auth.user.id — cross-schema reference kept as plain String
    @Column(name = "teacher_id", nullable = false)
    private String teacherId;

    @Column(name = "invite_code", nullable = false, unique = true)
    private String inviteCode;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(name = "banner_cld_pub_id")
    private String bannerCldPubId;

    @Column(name = "banner_url")
    private String bannerUrl;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private Integer capacity = 50;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "TEXT")
    private ClassStatus status = ClassStatus.ACTIVE;

    // JSONB stored as text; parse in service layer
    @Column(columnDefinition = "jsonb")
    private String schedules = "[]";

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
