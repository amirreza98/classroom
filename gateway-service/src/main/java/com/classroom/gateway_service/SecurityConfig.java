package com.classroom.gateway_service;

import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.security.web.server.util.matcher.ServerWebExchangeMatchers;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

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
                .authorizeExchange(exchanges -> exchanges.anyExchange().permitAll())
                .build();
    }

    // All other routes require a valid JWT issued by Better Auth
    @Bean
    @Order(2)
    public SecurityWebFilterChain protectedRouteChain(ServerHttpSecurity http) {
        return http
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                .authorizeExchange(exchanges -> exchanges.anyExchange().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
                .build();
    }

    // After JWT is validated, inject user identity headers for downstream services
    @Bean
    public GlobalFilter jwtHeadersFilter() {
        return (ServerWebExchange exchange, GatewayFilterChain chain) ->
                ReactiveSecurityContextHolder.getContext()
                        .map(SecurityContext::getAuthentication)
                        .flatMap(auth -> {
                            if (!(auth instanceof JwtAuthenticationToken jwtAuth)) {
                                return chain.filter(exchange);
                            }
                            var jwt = jwtAuth.getToken();
                            var mutated = exchange.mutate()
                                    .request(r -> r.headers(headers -> {
                                        headers.set("X-User-Id", jwt.getSubject());
                                        String role = jwt.getClaimAsString("role");
                                        if (role != null) headers.set("X-User-Role", role);
                                    }))
                                    .build();
                            return chain.filter(mutated);
                        })
                        .switchIfEmpty(chain.filter(exchange));
    }
}
