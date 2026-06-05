package com.homesight.dto;

import lombok.Data;
import java.util.List;

@Data
public class AnalyzeResponse {
    private Long floorPlanId;
    private Integer totalArea;
    private List<RoomInfo> rooms;
    private List<String> pros;
    private List<String> cautions;
    private FloorplanData floorplanData;

    @Data
    public static class RoomInfo {
        private String name;
        private String type;
        private Integer area;
        private List<Point> walls;
        private List<Point> doors;
        private List<Point> windows;
        private List<String> features;
    }

    @Data
    public static class Point {
        private Double x;
        private Double y;
    }

    @Data
    public static class FloorplanData {
        private List<WallLine> walls;
        private List<DoorRect> doors;
        private List<WindowRect> windows;
        private Dimensions dimensions;
    }

    @Data
    public static class WallLine {
        private Point start;
        private Point end;
    }

    @Data
    public static class DoorRect {
        private Point position;
        private Double width;
        private Double height;
    }

    @Data
    public static class WindowRect {
        private Point position;
        private Double width;
        private Double height;
    }

    @Data
    public static class Dimensions {
        private Double width;
        private Double height;
    }
}
