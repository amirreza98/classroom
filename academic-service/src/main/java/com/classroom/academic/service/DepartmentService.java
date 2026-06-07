package com.classroom.academic.service;

import com.classroom.academic.entity.academic.Department;
import com.classroom.academic.repository.academic.DepartmentRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class DepartmentService {

    private final DepartmentRepository repo;

    public DepartmentService(DepartmentRepository repo) {
        this.repo = repo;
    }

    public Page<Department> list(String search, int page, int limit) {
        PageRequest pageable = PageRequest.of(page - 1, limit, Sort.by("createdAt").descending());
        if (search != null && !search.isBlank()) {
            return repo.findByNameContainingIgnoreCase(search, pageable);
        }
        return repo.findAll(pageable);
    }

    public Department getById(Integer id) {
        return repo.findById(id).orElseThrow(() -> new EntityNotFoundException("Department not found"));
    }

    @Transactional
    public Department create(String code, String name, String description) {
        Department dept = new Department();
        dept.setCode(code);
        dept.setName(name);
        dept.setDescription(description);
        return repo.save(dept);
    }

    @Transactional
    public Department update(Integer id, String code, String name, String description) {
        Department dept = getById(id);
        if (code != null) dept.setCode(code);
        if (name != null) dept.setName(name);
        if (description != null) dept.setDescription(description);
        return repo.save(dept);
    }

    @Transactional
    public void delete(Integer id) {
        Department dept = getById(id);
        try {
            repo.delete(dept);
            repo.flush();
        } catch (DataIntegrityViolationException e) {
            throw new IllegalStateException("Cannot delete department with existing subjects");
        }
    }
}
