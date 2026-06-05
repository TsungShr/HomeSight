package com.homesight.repository;

import com.homesight.entity.RoomLayout;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface RoomLayoutRepository extends JpaRepository<RoomLayout, Long> {
    List<RoomLayout> findByFloorPlanId(Long floorPlanId);
    Optional<RoomLayout> findByFloorPlanIdAndRoomId(Long floorPlanId, String roomId);
}
