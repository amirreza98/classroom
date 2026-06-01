package com.classroom.gateway_service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.NimbusReactiveJwtDecoder;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.security.web.server.util.matcher.ServerWebExchangeMatchers;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;

@Configuration
@EnableWebFluxSecurity
public class SecurityConfig {

    // Auth routes bypass JWT validation entirely — login/callback/logout never carry a token
    @Bean
    @Order(1)
    public SecurityWebFilterChain authRouteChain(ServerHttpSecurity http) {
        return http
                .securityMatcher(ServerWebExchangeMatchers.pathMatchers("/api/auth/**"))
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                .authorizeExchange(ex -> ex.anyExchange().permitAll())
                .build();
    }

    // All other routes require a valid JWT; missing/invalid token → JSON 401
    @Bean
    @Order(2)
    public SecurityWebFilterChain protectedRouteChain(ServerHttpSecurity http) {
        return http
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                .authorizeExchange(ex -> ex.anyExchange().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> {})
                        .authenticationEntryPoint((exchange, ex) ->
                                writeJson(exchange, HttpStatus.UNAUTHORIZED, "{\"error\":\"Unauthorized\"}")
                        )
                )
                .build();
    }

    // NimbusReactiveJwtDecoder fetches the JWK set lazily on the first validated request,
    // so the gateway starts fine even when the JWKS endpoint is temporarily unavailable.
    // Better Auth issues ES256 tokens, so we pin that algorithm to reject unexpected algs.
    @Bean
    public ReactiveJwtDecoder jwtDecoder(
            @Value("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri}") String jwkSetUri) {
        return NimbusReactiveJwtDecoder
                .withJwkSetUri(jwkSetUri)
                .jwsAlgorithm(SignatureAlgorithm.ES256)
                .build();
    }

    // Inject user-identity headers so downstream services can trust them without re-validating the JWT
    @Bean
    @Order(-2)
    public GlobalFilter jwtHeadersFilter() {
        return (ServerWebExchange exchange, GatewayFilterChain chain) -> {
            String authHeader = exchange.getRequest().getHeaders().getFirst("Authorization");
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                return chain.filter(exchange);
            }
            
            // Decode JWT without validation (validation already done by Spring Security)
            String token = authHeader.substring(7);
            String[] parts = token.split("\\.");
            if (parts.length != 3) return chain.filter(exchange);
            
            try {
                String payload = new String(java.util.Base64.getUrlDecoder().decode(parts[1]));
                com.fasterxml.jackson.databind.JsonNode node = 
                    new com.fasterxml.jackson.databind.ObjectMapper().readTree(payload);
                
                String userId = node.path("sub").asText("");
                String role = node.path("role").asText("");
                String email = node.path("email").asText("");
                
                var req = exchange.getRequest().mutate()
                    .header("X-User-Id", userId)
                    .header("X-User-Role", role)
                    .header("X-User-Email", email)
                    .build();
                
                return chain.filter(exchange.mutate().request(req).build());
            } catch (Exception e) {
                return chain.filter(exchange);
            }
        };
    }

    static Mono<Void> writeJson(ServerWebExchange exchange, HttpStatus status, String body) {
        var response = exchange.getResponse();
        response.setStatusCode(status);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        DataBuffer buf = response.bufferFactory()
                .wrap(body.getBytes(StandardCharsets.UTF_8));
        return response.writeWith(Mono.just(buf));
    }
}
