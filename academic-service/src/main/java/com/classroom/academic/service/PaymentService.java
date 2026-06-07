package com.classroom.academic.service;

import com.classroom.academic.entity.engagement.Enrollment;
import com.classroom.academic.entity.engagement.Payment;
import com.classroom.academic.enums.EnrollmentPaymentStatus;
import com.classroom.academic.enums.PaymentRecordStatus;
import com.classroom.academic.kafka.EventPublisher;
import com.classroom.academic.repository.engagement.EnrollmentRepository;
import com.classroom.academic.repository.engagement.PaymentRepository;
import com.stripe.model.Event;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
@Transactional(readOnly = true)
public class PaymentService {

    private final PaymentRepository paymentRepo;
    private final EnrollmentRepository enrollmentRepo;
    private final EventPublisher events;

    @Value("${stripe.webhook-secret}")
    private String webhookSecret;

    public PaymentService(PaymentRepository paymentRepo,
                          EnrollmentRepository enrollmentRepo,
                          EventPublisher events) {
        this.paymentRepo = paymentRepo;
        this.enrollmentRepo = enrollmentRepo;
        this.events = events;
    }

    public List<Payment> getMyPayments(String studentId) {
        return paymentRepo.findByStudentIdOrderByCreatedAtDesc(studentId);
    }

    public Page<Payment> listAll(int page, int limit) {
        PageRequest pageable = PageRequest.of(page - 1, limit, Sort.by("createdAt").descending());
        return paymentRepo.findAll(pageable);
    }

    @Transactional
    public void handleStripeWebhook(String payload, String sigHeader) throws Exception {
        Event event = Webhook.constructEvent(payload, sigHeader, webhookSecret);

        if ("checkout.session.completed".equals(event.getType())) {
            Session session = (Session) event.getDataObjectDeserializer()
                    .getObject().orElseThrow();

            Map<String, String> meta = session.getMetadata();
            String studentId = meta.get("studentId");
            String classId = meta.get("classId");
            String subjectId = meta.get("subjectId");

            Payment payment = paymentRepo.findByStripeSessionId(session.getId())
                    .orElseThrow(() -> new EntityNotFoundException("Payment not found"));
            payment.setStatus(PaymentRecordStatus.PAID);
            payment.setStripePaymentIntentId(session.getPaymentIntent());
            paymentRepo.save(payment);

            Enrollment enrollment = payment.getEnrollment();
            enrollment.setPaymentStatus(EnrollmentPaymentStatus.PAID);
            enrollmentRepo.save(enrollment);

            if (studentId != null && classId != null) {
                events.publish("student.actions", Map.of(
                        "event", "student.enrolled",
                        "studentId", studentId,
                        "classId", Integer.parseInt(classId),
                        "subjectId", subjectId != null ? Integer.parseInt(subjectId) : 0,
                        "timestamp", Instant.now().toString()
                ));
            }
        }

        if ("checkout.session.expired".equals(event.getType())) {
            Session session = (Session) event.getDataObjectDeserializer()
                    .getObject().orElseThrow();
            paymentRepo.findByStripeSessionId(session.getId()).ifPresent(p -> {
                p.setStatus(PaymentRecordStatus.FAILED);
                paymentRepo.save(p);
                Enrollment enrollment = p.getEnrollment();
                enrollment.setPaymentStatus(EnrollmentPaymentStatus.FAILED);
                enrollmentRepo.save(enrollment);
            });
        }
    }
}
