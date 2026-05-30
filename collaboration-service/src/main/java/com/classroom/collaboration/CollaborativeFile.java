package com.classroom.collaboration;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(
        name = "collaborative_files",
        uniqueConstraints = @UniqueConstraint(columnNames = {"class_id", "file_id"})
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CollaborativeFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "class_id", nullable = false)
    private String classId;

    @Column(name = "file_id", nullable = false)
    private String fileId;

    @Column(name = "yjs_state", columnDefinition = "bytea")
    private byte[] yjsState;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
