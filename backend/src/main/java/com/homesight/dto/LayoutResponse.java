package com.homesight.dto;

import lombok.Data;
import java.util.List;

@Data
public class LayoutResponse {
    private List<PowerOutlet> powerOutlets;
    private List<NetworkPort> networkPorts;
    private List<Switch> switches;
    private List<WaterLine> waterLines;
    private List<ElectricalRoute> electricalRoutes;
    private List<String> tips;

    @Data
    public static class PowerOutlet {
        private Double x;
        private Double y;
        private String type; // 普通/大功率/USB
        private String roomId;
    }

    @Data
    public static class NetworkPort {
        private Double x;
        private Double y;
        private String type; // RJ45/WiFi
        private String roomId;
    }

    @Data
    public static class Switch {
        private Double x;
        private Double y;
        private String type; // 单开/双开/智能开关
        private String roomId;
    }

    @Data
    public static class WaterLine {
        private List<Point> points;
        private String roomId;
    }

    @Data
    public static class ElectricalRoute {
        private List<Point> points;
        private String roomId;
    }

    @Data
    public static class Point {
        private Double x;
        private Double y;
    }
}
