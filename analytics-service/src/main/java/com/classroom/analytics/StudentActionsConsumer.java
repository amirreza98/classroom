package com.classroom.analytics;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class StudentActionsConsumer {

    private final StudentEventRepository studentEventRepository;
    private final ObjectMapper objectMapper;

    @KafkaListener(topics = "student.actions", groupId = "analytics-group")
    public void consume(String message) {
        try {
            JsonNode node = objectMapper.readTree(message);
            String studentId = node.has("studentId") ? node.get("studentId").asText(null) : null;
            if (studentId == null || studentId.isBlank()) return; // skip non-student events

            String eventType = node.has("event") ? node.get("event").asText() : "unknown";
            Integer classId = node.has("classId") && !node.get("classId").isNull()
                    ? node.get("classId").asInt() : null;
            Integer subjectId = node.has("subjectId") && !node.get("subjectId").isNull()
                    ? node.get("subjectId").asInt() : null;

            StudentEvent event = StudentEvent.builder()
                    .studentId(studentId)
                    .eventType(eventType)
                    .classId(classId)
                    .subjectId(subjectId)
                    .metadata(message)
                    .build();

            studentEventRepository.save(event);
            log.debug("Stored event {} for student {}", eventType, studentId);
        } catch (Exception e) {
            log.error("Failed to process Kafka message: {}", message, e);
        }
    }
}
