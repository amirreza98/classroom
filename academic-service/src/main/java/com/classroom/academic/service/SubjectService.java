package com.classroom.academic.service;

import com.classroom.academic.entity.academic.Department;
import com.classroom.academic.entity.academic.Subject;
import com.classroom.academic.repository.academic.DepartmentRepository;
import com.classroom.academic.repository.academic.SubjectRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
@Transactional(readOnly = true)
public class SubjectService {

    private final SubjectRepository repo;
    private final DepartmentRepository deptRepo;

    public SubjectService(SubjectRepository repo, DepartmentRepository deptRepo) {
        this.repo = repo;
        this.deptRepo = deptRepo;
    }

    public Page<Subject> list(String search, String department, int page, int limit) {
        PageRequest pageable = PageRequest.of(page - 1, limit, Sort.by("createdAt").descending());
        String s = (search != null && !search.isBlank()) ? search : null;
        String d = (department != null && !department.isBlank()) ? department : null;
        return repo.findWithFilters(s, d, pageable);
    }

    public Subject getById(Integer id) {
        return repo.findById(id).orElseThrow(() -> new EntityNotFoundException("Subject not found"));
    }

    @Transactional
    public Subject create(String name, String code, String description, Integer departmentId, BigDecimal price) {
        Department dept = deptRepo.findById(departmentId)
                .orElseThrow(() -> new EntityNotFoundException("Department not found"));
        Subject subject = new Subject();
        subject.setName(name);
        subject.setCode(code);
        subject.setDescription(description);
        subject.setDepartment(dept);
        subject.setPrice(price != null ? price : BigDecimal.ZERO);
        return repo.save(subject);
    }

    @Transactional
    public Subject update(Integer id, String name, String code, String description,
                          Integer departmentId, BigDecimal price) {
        Subject subject = getById(id);
        if (name != null) subject.setName(name);
        if (code != null) subject.setCode(code);
        if (description != null) subject.setDescription(description);
        if (departmentId != null) {
            Department dept = deptRepo.findById(departmentId)
                    .orElseThrow(() -> new EntityNotFoundException("Department not found"));
            subject.setDepartment(dept);
        }
        if (price != null) subject.setPrice(price);
        return repo.save(subject);
    }

    @Transactional
    public void delete(Integer id) {
        Subject subject = getById(id);
        try {
            repo.delete(subject);
            repo.flush();
        } catch (DataIntegrityViolationException e) {
            throw new IllegalStateException("Cannot delete subject with existing classes");
        }
    }
}
