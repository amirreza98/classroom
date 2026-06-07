package com.classroom.academic.repository.academic;

import com.classroom.academic.entity.academic.Department;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DepartmentRepository extends JpaRepository<Department, Integer> {
    Page<Department> findByNameContainingIgnoreCase(String name, Pageable pageable);
    boolean existsByCode(String code);
}
