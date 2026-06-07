package com.classroom.academic.repository.academic;

import com.classroom.academic.entity.academic.Subject;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SubjectRepository extends JpaRepository<Subject, Integer> {

    @Query("""
        SELECT s FROM Subject s JOIN FETCH s.department d
        WHERE (:search IS NULL OR LOWER(s.name) LIKE LOWER(CONCAT('%', :search, '%'))
                               OR LOWER(s.code) LIKE LOWER(CONCAT('%', :search, '%')))
          AND (:department IS NULL OR LOWER(d.name) LIKE LOWER(CONCAT('%', :department, '%')))
        """)
    Page<Subject> findWithFilters(@Param("search") String search,
                                   @Param("department") String department,
                                   Pageable pageable);
}
