package com.classroom.academic.repository.engagement;

import com.classroom.academic.entity.engagement.Enrollment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface EnrollmentRepository extends JpaRepository<Enrollment, Integer> {

    Page<Enrollment> findByClassEntity_Id(Integer classId, Pageable pageable);
    Page<Enrollment> findByStudentId(String studentId, Pageable pageable);
    Page<Enrollment> findByClassEntity_IdAndStudentId(Integer classId, String studentId, Pageable pageable);

    boolean existsByStudentIdAndClassEntity_Id(String studentId, Integer classId);
    long countByClassEntity_Id(Integer classId);

    Optional<Enrollment> findByStudentIdAndClassEntity_Id(String studentId, Integer classId);

    @Query("""
        SELECT e FROM Enrollment e
        JOIN FETCH e.classEntity c
        JOIN FETCH c.subject s
        WHERE e.studentId = :studentId
        """)
    java.util.List<Enrollment> findByStudentIdWithDetails(@Param("studentId") String studentId);
}
