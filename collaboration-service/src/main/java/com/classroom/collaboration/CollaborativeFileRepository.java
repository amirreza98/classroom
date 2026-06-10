package com.classroom.collaboration;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CollaborativeFileRepository extends JpaRepository<CollaborativeFile, Long> {
    Optional<CollaborativeFile> findByClassIdAndFileId(String classId, String fileId);
    List<CollaborativeFile> findByClassId(String classId);

}
