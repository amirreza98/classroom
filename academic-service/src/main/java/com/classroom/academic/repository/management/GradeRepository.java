package com.classroom.academic.repository.management;

import com.classroom.academic.entity.management.Grade;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GradeRepository extends JpaRepository<Grade, Integer> {
    List<Grade> findByStudentIdOrderByCreatedAtDesc(String studentId);
    Page<Grade> findByClassEntity_Id(Integer classId, Pageable pageable);
    List<Grade> findByStudentIdAndClassEntity_Id(String studentId, Integer classId);
}
