package com.classroom.collaboration;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/collaboration")
@Slf4j
@RequiredArgsConstructor
public class CollaborationController {

    private static final Pattern TOPIC_PATTERN =
            Pattern.compile("^/topic/collaboration/([^/]+)/([^/]+)$");

    private final SimpMessagingTemplate messagingTemplate;
    private final CollaborativeFileRepository fileRepository;

    @GetMapping("/classes/{classId}/files")
    public ResponseEntity<List<CollaborativeFile>> getFilesByClass(
            @PathVariable String classId) {
        return ResponseEntity.ok(fileRepository.findByClassId(classId));
    }

    @PostMapping("/classes/{classId}/files")
    public ResponseEntity<Map<String, Object>> createFile(
            @PathVariable String classId,
            @RequestBody CreateFileRequest request) {

        CollaborativeFile file = fileRepository.save(CollaborativeFile.builder()
                .classId(classId)
                .fileId(UUID.randomUUID().toString())
                .name(request.getName())
                .createdBy(request.getCreatedBy())
                .build());

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("data", file));
    }

    @MessageMapping("/collaboration/{classId}/{fileId}/sync")
    public void handleSync(
            @DestinationVariable String classId,
            @DestinationVariable String fileId,
            @Payload byte[] update) {

        log.debug("Received Yjs update for class={} file={}", classId, fileId);

        fileRepository.findByClassIdAndFileId(classId, fileId)
                .ifPresentOrElse(
                        file -> {
                            file.setYjsState(update);
                            fileRepository.save(file);
                        },
                        () -> fileRepository.save(CollaborativeFile.builder()
                                .classId(classId)
                                .fileId(fileId)
                                .yjsState(update)
                                .build())
                );

        messagingTemplate.convertAndSend(
                "/topic/collaboration/" + classId + "/" + fileId,
                update
        );
    }

    @EventListener
    public void handleSubscribe(SessionSubscribeEvent event) {
        SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.wrap(event.getMessage());
        String destination = headers.getDestination();
        String sessionId = headers.getSessionId();

        if (destination == null || sessionId == null) return;

        Matcher matcher = TOPIC_PATTERN.matcher(destination);
        if (!matcher.matches()) return;

        String classId = matcher.group(1);
        String fileId = matcher.group(2);

        fileRepository.findByClassIdAndFileId(classId, fileId).ifPresent(file -> {
            if (file.getYjsState() == null || file.getYjsState().length == 0) return;

            SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
            accessor.setSessionId(sessionId);
            accessor.setLeaveMutable(true);

            messagingTemplate.convertAndSend(destination, file.getYjsState(), accessor.getMessageHeaders());
            log.debug("Sent initial Yjs state to session={} for class={} file={}", sessionId, classId, fileId);
        });
    }
}