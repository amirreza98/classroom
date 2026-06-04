package com.classroom.analytics;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface StudentEventRepository extends JpaRepository<StudentEvent, Long> {

    List<StudentEvent> findByStudentIdOrderByCreatedAtDesc(String studentId, Pageable pageable);

    @Query("SELECT e.eventType, COUNT(e) FROM StudentEvent e WHERE e.studentId = :id GROUP BY e.eventType")
    List<Object[]> countByTypeForStudent(@Param("id") String studentId);
}
