package com.homesight.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

@Entity
@Table(name = "floor_plans")
@Data
public class FloorPlan {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String openId;

    @Column(nullable = false)
    private String fileName;

    private String imageUrl;

    private String thumbnailUrl;

    @Column(columnDefinition = "TEXT")
    private String floorplanData;

    @Column(columnDefinition = "TEXT")
    private String analysisResult;

    private String status; // draft | analyzed | edited | layoutDone

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = "draft";
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
