package com.classroom.academic.controller;

import com.classroom.academic.service.PaymentService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/stripe")
public class StripeWebhookController {

    private static final Logger log = LoggerFactory.getLogger(StripeWebhookController.class);

    private final PaymentService service;

    public StripeWebhookController(PaymentService service) {
        this.service = service;
    }

    @PostMapping("/webhook")
    public ResponseEntity<?> webhook(
            @RequestBody String payload,
            @RequestHeader("Stripe-Signature") String sigHeader) {
        try {
            service.handleStripeWebhook(payload, sigHeader);
            return ResponseEntity.ok(Map.of("received", true));
        } catch (com.stripe.exception.SignatureVerificationException e) {
            log.error("Stripe signature verification failed: {}", e.getMessage());
            return ResponseEntity.status(400).body(Map.of("error", "Invalid signature"));
        } catch (Exception e) {
            log.error("Stripe webhook processing error: {}", e.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", "Webhook processing failed"));
        }
    }
}
