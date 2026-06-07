package com.classroom.academic.repository.engagement;

import com.classroom.academic.entity.engagement.Payment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Integer> {
    List<Payment> findByStudentIdOrderByCreatedAtDesc(String studentId);
    Optional<Payment> findByStripeSessionId(String stripeSessionId);
    Page<Payment> findAll(Pageable pageable);
}
