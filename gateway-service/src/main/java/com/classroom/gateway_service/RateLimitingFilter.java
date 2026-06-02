package com.classroom.gateway_service;

import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.annotation.Order;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.Map;

/**
 * Redis-backed fixed-window rate limiter.
 * Runs before jwtHeadersFilter (@Order(0)) so limits are checked before downstream mutation.
 * Skips /api/auth/** entirely. Fails open on Redis errors to avoid gateway downtime.
 */
@Component
@Order(-1)
public class RateLimitingFilter implements GlobalFilter {

    private static final Duration WINDOW = Duration.ofMinutes(1);
    private static final Map<String, Integer> ROLE_LIMITS = Map.of(
            "admin",   300,
            "teacher", 120,
            "student", 60
    );

    private final ReactiveStringRedisTemplate redis;

    public RateLimitingFilter(ReactiveStringRedisTemplate redis) {
        this.redis = redis;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        if (exchange.getRequest().getURI().getPath().startsWith("/api/auth/")) {
            return chain.filter(exchange);
        }

        return ReactiveSecurityContextHolder.getContext()
                .flatMap(ctx -> {
                    var auth = ctx.getAuthentication();
                    if (!(auth instanceof JwtAuthenticationToken jwtAuth)) {
                        return Mono.empty();
                    }
                    var jwt = jwtAuth.getToken();
                    String userId = jwt.getSubject();
                    String role = jwt.getClaimAsString("role");
                    int limit = ROLE_LIMITS.getOrDefault(role, 60);

                    return checkLimit("rl:" + userId, limit)
                            .onErrorReturn(true);
                })
                .defaultIfEmpty(true)
                .flatMap(allowed -> allowed
                        ? chain.filter(exchange)
                        : SecurityConfig.writeJson(
                                exchange,
                                HttpStatus.TOO_MANY_REQUESTS,
                                "{\"error\":\"Too many requests\"}"));
    }

    private Mono<Boolean> checkLimit(String key, int limit) {
        return redis.opsForValue().increment(key)
                .flatMap(count -> count == 1
                        ? redis.expire(key, WINDOW).thenReturn(count)
                        : Mono.just(count))
                .map(count -> count <= limit);
    }
}
