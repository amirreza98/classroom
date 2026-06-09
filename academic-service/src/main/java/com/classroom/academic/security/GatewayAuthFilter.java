package com.classroom.academic.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Trusts user identity injected by the Spring Cloud Gateway after JWT validation.
 * Mirrors the Express securityMiddleware: reads x-user-id, x-user-role, x-user-email.
 */
@Component
public class GatewayAuthFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String userId = request.getHeader("x-user-id");
        String userRole = request.getHeader("x-role"); 
        String userEmail = request.getHeader("x-user-email");

        if (userId != null && userRole != null) {
            UserPrincipal principal = new UserPrincipal(userId, userEmail != null ? userEmail : "", userRole);
            UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
            SecurityContextHolder.getContext().setAuthentication(auth);
        }

        chain.doFilter(request, response);
    }
}
