package com.classroom.academic.entity.engagement;

import com.classroom.academic.entity.academic.ClassEntity;
import com.classroom.academic.enums.EnrollmentPaymentStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "enrollments",
    schema = "engagement",
    uniqueConstraints = @UniqueConstraint(columnNames = {"student_id", "class_id"})
)
@Getter @Setter
public class Enrollment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    // References auth.user.id
    @Column(name = "student_id", nullable = false)
    private String studentId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "class_id", nullable = false)
    private ClassEntity classEntity;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", nullable = false, columnDefinition = "TEXT")
    private EnrollmentPaymentStatus paymentStatus = EnrollmentPaymentStatus.FREE;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
