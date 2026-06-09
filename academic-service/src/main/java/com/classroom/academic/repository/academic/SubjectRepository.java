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
        WHERE (:search IS NULL OR LOWER(s.name) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
                            OR LOWER(s.code) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%')))
        AND (:department IS NULL OR LOWER(d.name) LIKE LOWER(CONCAT('%', CAST(:department AS string), '%')))
        """)
    Page<Subject> findWithFilters(@Param("search") String search,
                                @Param("department") String department,
                                Pageable pageable);
}
