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
import java.util.Enumeration;

@Component
public class GatewayAuthFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {

        // Debug: print all incoming headers
        Enumeration<String> headerNames = request.getHeaderNames();
        while (headerNames != null && headerNames.hasMoreElements()) {
            String headerName = headerNames.nextElement();
            System.out.println(">>> Header: " + headerName + " = " + request.getHeader(headerName));
        }

        String userId = request.getHeader("x-user-id");
        String userRole = request.getHeader("x-user-role");
        String userEmail = request.getHeader("x-user-email");

        System.out.println(">>> Academic filter - userId: " + userId + " userRole: " + userRole);

        if (userId != null && userRole != null) {
            UserPrincipal principal = new UserPrincipal(userId, userEmail != null ? userEmail : "", userRole);
            UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
            SecurityContextHolder.getContext().setAuthentication(auth);
        }

        chain.doFilter(request, response);
    }
}