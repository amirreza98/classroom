package com.classroom.academic.service;

import com.classroom.academic.entity.academic.ClassEntity;
import com.classroom.academic.entity.engagement.Enrollment;
import com.classroom.academic.entity.engagement.Payment;
import com.classroom.academic.enums.EnrollmentPaymentStatus;
import com.classroom.academic.kafka.EventPublisher;
import com.classroom.academic.repository.academic.ClassRepository;
import com.classroom.academic.repository.engagement.EnrollmentRepository;
import com.classroom.academic.repository.engagement.PaymentRepository;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
@Transactional(readOnly = true)
public class EnrollmentService {

    private final EnrollmentRepository enrollmentRepo;
    private final PaymentRepository paymentRepo;
    private final ClassRepository classRepo;
    private final EventPublisher events;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    public EnrollmentService(EnrollmentRepository enrollmentRepo,
                             PaymentRepository paymentRepo,
                             ClassRepository classRepo,
                             EventPublisher events) {
        this.enrollmentRepo = enrollmentRepo;
        this.paymentRepo = paymentRepo;
        this.classRepo = classRepo;
        this.events = events;
    }

    public Page<Enrollment> list(Integer classId, String studentId, int page, int limit) {
        PageRequest pageable = PageRequest.of(page - 1, limit, Sort.by("createdAt").descending());
        if (classId != null && studentId != null) {
            return enrollmentRepo.findByClassEntity_IdAndStudentId(classId, studentId, pageable);
        } else if (classId != null) {
            return enrollmentRepo.findByClassEntity_Id(classId, pageable);
        } else {
            return enrollmentRepo.findByStudentId(studentId, pageable);
        }
    }

    /** Teacher/admin enrolls a student directly (no payment check). */
    @Transactional
    public Enrollment enroll(Integer classId, String studentId) {
        ClassEntity cls = classRepo.findById(classId)
                .orElseThrow(() -> new EntityNotFoundException("Class not found"));

        long enrolled = enrollmentRepo.countByClassEntity_Id(classId);
        if (enrolled >= cls.getCapacity()) {
            throw new IllegalStateException("Class is at full capacity");
        }

        Enrollment enrollment = new Enrollment();
        enrollment.setStudentId(studentId);
        enrollment.setClassEntity(cls);
        enrollment.setPaymentStatus(EnrollmentPaymentStatus.FREE);

        try {
            return enrollmentRepo.save(enrollment);
        } catch (DataIntegrityViolationException e) {
            throw new IllegalStateException("Student is already enrolled in this class");
        }
    }

    /**
     * Student self-enrolls. Returns a Stripe checkout URL if payment is required,
     * or the completed enrollment if free.
     */
    @Transactional
    public SelfEnrollResult selfEnroll(Integer classId, String inviteCode, String studentId) throws Exception {
        ClassEntity cls = classRepo.findById(classId)
                .orElseThrow(() -> new EntityNotFoundException("Class not found"));

        if (inviteCode != null && !cls.getInviteCode().equals(inviteCode)) {
            throw new IllegalArgumentException("Invalid invite code");
        }

        long enrolled = enrollmentRepo.countByClassEntity_Id(classId);
        if (enrolled >= cls.getCapacity()) {
            throw new IllegalStateException("Class is at full capacity");
        }

        BigDecimal price = cls.getSubject().getPrice();

        if (price != null && price.compareTo(BigDecimal.ZERO) > 0) {
            // Paid enrollment — create Stripe Checkout session
            Session stripeSession = Session.create(
                SessionCreateParams.builder()
                    .setMode(SessionCreateParams.Mode.PAYMENT)
                    .addLineItem(
                        SessionCreateParams.LineItem.builder()
                            .setQuantity(1L)
                            .setPriceData(
                                SessionCreateParams.LineItem.PriceData.builder()
                                    .setCurrency("usd")
                                    .setUnitAmount(price.multiply(BigDecimal.valueOf(100)).longValue())
                                    .setProductData(
                                        SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                            .setName(cls.getSubject().getName())
                                            .build()
                                    )
                                    .build()
                            )
                            .build()
                    )
                    .setSuccessUrl(frontendUrl + "/payment/success?session_id={CHECKOUT_SESSION_ID}")
                    .setCancelUrl(frontendUrl + "/payment/cancel")
                    .putMetadata("classId", String.valueOf(cls.getId()))
                    .putMetadata("studentId", studentId)
                    .putMetadata("subjectId", String.valueOf(cls.getSubject().getId()))
                    .build()
            );

            Enrollment enrollment = new Enrollment();
            enrollment.setStudentId(studentId);
            enrollment.setClassEntity(cls);
            enrollment.setPaymentStatus(EnrollmentPaymentStatus.PENDING);
            Enrollment saved = enrollmentRepo.save(enrollment);

            Payment payment = new Payment();
            payment.setEnrollment(saved);
            payment.setStudentId(studentId);
            payment.setStripeSessionId(stripeSession.getId());
            payment.setAmount(price);
            payment.setCurrency("usd");
            paymentRepo.save(payment);

            return new SelfEnrollResult(true, stripeSession.getUrl(), null);
        }

        // Free enrollment
        Enrollment enrollment = new Enrollment();
        enrollment.setStudentId(studentId);
        enrollment.setClassEntity(cls);
        enrollment.setPaymentStatus(EnrollmentPaymentStatus.FREE);

        try {
            Enrollment saved = enrollmentRepo.save(enrollment);
            events.publish("student.actions", Map.of(
                    "event", "student.enrolled",
                    "studentId", studentId,
                    "classId", cls.getId(),
                    "subjectId", cls.getSubject().getId(),
                    "timestamp", Instant.now().toString()
            ));
            return new SelfEnrollResult(false, null, saved);
        } catch (DataIntegrityViolationException e) {
            throw new IllegalStateException("Already enrolled in this class");
        }
    }

    @Transactional
    public void unenroll(Integer enrollmentId) {
        Enrollment enrollment = enrollmentRepo.findById(enrollmentId)
                .orElseThrow(() -> new EntityNotFoundException("Enrollment not found"));
        enrollmentRepo.delete(enrollment);
    }

    public List<Enrollment> getStudentEnrollmentsWithDetails(String studentId) {
        return enrollmentRepo.findByStudentIdWithDetails(studentId);
    }

    public record SelfEnrollResult(boolean requiresPayment, String checkoutUrl, Enrollment enrollment) {}
}
