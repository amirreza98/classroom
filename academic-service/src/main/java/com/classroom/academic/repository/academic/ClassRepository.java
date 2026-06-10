package com.classroom.academic.repository.academic;

import com.classroom.academic.entity.academic.ClassEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ClassRepository extends JpaRepository<ClassEntity, Integer> {

    @Query("""
        SELECT c FROM ClassEntity c JOIN FETCH c.subject s
        WHERE (:search IS NULL OR LOWER(c.name) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
                            OR LOWER(c.inviteCode) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%')))
        AND (:subject IS NULL OR LOWER(s.name) LIKE LOWER(CONCAT('%', CAST(:subject AS string), '%')))
        AND (:teacher IS NULL OR LOWER(c.teacherId) LIKE LOWER(CONCAT('%', CAST(:teacher AS string), '%')))
        """)
    Page<ClassEntity> findWithFilters(@Param("search") String search,
                                      @Param("subject") String subject,
                                      @Param("teacher") String teacher,
                                      Pageable pageable);

    @Query("SELECT c FROM ClassEntity c JOIN FETCH c.subject WHERE c.id = :id")
    Optional<ClassEntity> findByIdWithSubject(@Param("id") Integer id);
}