package com.classroom.collaboration;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

@Slf4j
public class GatewayHandshakeInterceptor implements HandshakeInterceptor {

    @Override
    public boolean beforeHandshake(ServerHttpRequest request,
                                   ServerHttpResponse response,
                                   WebSocketHandler wsHandler,
                                   Map<String, Object> attributes) {
        String userId = request.getHeaders().getFirst("X-User-Id");
        String role   = request.getHeaders().getFirst("X-User-Role");
        String email  = request.getHeaders().getFirst("X-User-Email");

        if (userId != null && !userId.isBlank()) {
            attributes.put("userId",    userId);
            attributes.put("userRole",  role  != null ? role  : "");
            attributes.put("userEmail", email != null ? email : "");
            log.debug("WS handshake: userId={} role={}", userId, role);
        }
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request,
                               ServerHttpResponse response,
                               WebSocketHandler wsHandler,
                               Exception exception) {}
}
