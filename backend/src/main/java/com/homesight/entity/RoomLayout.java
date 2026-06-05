package com.homesight.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "room_layouts")
@Data
public class RoomLayout {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long floorPlanId;

    @Column(nullable = false)
    private String roomId;

    @Column(columnDefinition = "TEXT")
    private String furniture; // JSON array of furniture items

    @Column(columnDefinition = "TEXT")
    private String layoutData; // power outlets, network ports, etc.

    private LocalDateTime updatedAt;

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
