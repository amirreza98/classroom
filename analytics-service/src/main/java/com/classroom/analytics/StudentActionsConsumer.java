package com.classroom.analytics;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

@Service
public class StudentActionsConsumer {

    @KafkaListener(topics = "student.actions", groupId = "analytics-group")
    public void consume(String message) {
        System.out.println("Received event: " + message);
    }
}